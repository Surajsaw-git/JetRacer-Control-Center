#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
JetRacer Control Center — Robot Helper Agent (Phase 7B)

Provides a strictly bounded, audited ROS 1 service interface for robot-side
lifecycle management: starting/stopping SLAM mapping, saving maps via map_saver,
listing saved maps on disk, safe deletion (moves to .trash), and chunked transfer.

Security Guarantees:
- Never executes shell strings (shell=False everywhere; tokenized argument lists only).
- Whitelists map names via strict regex: ^[a-zA-Z0-9_-]+$ (rejects path traversal).
- Enforces filesystem jail strictly within maps_dir (~/maps by default).
- Implements non-destructive deletion: maps moved to ~/maps/.trash/<name>_<timestamp>.
- Compatible with Python 2.7 (ROS Melodic on Jetson Nano) and Python 3.
"""

from __future__ import print_function, division, absolute_import

import os
import sys
import re
import json
import time
import signal
import base64
import shutil
import subprocess

import rospy
from jetracer_cc_msgs.srv import AgentCommand, AgentCommandResponse

AGENT_VERSION = "0.8.1-phase7b"
MAP_NAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-]+$")
CHUNK_SIZE_BYTES = 48 * 1024  # 48 KB base64 chunks for safe rosbridge transport


class JccAgentNode(object):
    def __init__(self):
        rospy.init_node("jetracer_cc_agent", anonymous=False)

        # Configurable parameters via ROS param server (with safe defaults)
        self.maps_dir = os.path.expanduser(
            rospy.get_param("~maps_dir", "~/maps")
        )
        self.trash_dir = os.path.join(self.maps_dir, ".trash")
        self.slam_pkg = rospy.get_param("~slam_pkg", "jetracer")
        self.slam_launch = rospy.get_param("~slam_launch", "slam.launch")

        # Ensure directories exist
        if not os.path.exists(self.maps_dir):
            try:
                os.makedirs(self.maps_dir)
            except Exception as e:
                rospy.logwarn("Failed to create maps_dir %s: %s", self.maps_dir, str(e))

        if not os.path.exists(self.trash_dir):
            try:
                os.makedirs(self.trash_dir)
            except Exception as e:
                rospy.logwarn("Failed to create trash_dir %s: %s", self.trash_dir, str(e))

        # Runtime process management state
        self.mapping_process = None
        self.mapping_start_time = None
        self.start_time = time.time()

        # Advertise service
        self.srv = rospy.Service(
            "~command",
            AgentCommand,
            self.handle_command
        )

        rospy.loginfo(
            "[JCC Agent] Service initialized at %s with maps_dir=%s",
            self.srv.resolved_name,
            self.maps_dir,
        )

    # -------------------------------------------------------------------------
    # Security & Path Validation Helpers
    # -------------------------------------------------------------------------

    def _sanitize_map_name(self, name):
        """Validates that a user-supplied map name contains only safe alphanumeric chars."""
        if not name or not isinstance(name, (str, bytes)):
            return False, "Map name must be a non-empty string."
        clean = name.strip()
        if not MAP_NAME_REGEX.match(clean):
            return False, "Invalid map name '%s'. Allowed characters: letters, numbers, underscore, hyphen." % clean
        return True, clean

    def _resolve_map_path(self, map_name):
        """Resolves target path and guarantees containment inside maps_dir."""
        valid, result = self._sanitize_map_name(map_name)
        if not valid:
            return False, result, None

        clean_name = result
        target_path = os.path.abspath(os.path.join(self.maps_dir, clean_name))
        real_maps_dir = os.path.realpath(self.maps_dir)
        real_target_path = os.path.realpath(os.path.dirname(target_path))

        # Jail check: target must be inside maps_dir
        if not (real_target_path == real_maps_dir or real_target_path.startswith(real_maps_dir + os.sep)):
            return False, "Path traversal attempt blocked.", None

        return True, clean_name, target_path

    # -------------------------------------------------------------------------
    # Command Dispatcher
    # -------------------------------------------------------------------------

    def handle_command(self, req):
        cmd = (req.command or "").strip().lower()
        args = {}
        if req.args_json:
            try:
                args = json.loads(req.args_json)
            except Exception as e:
                return AgentCommandResponse(
                    success=False,
                    message="Malformed JSON in args_json: %s" % str(e),
                    payload_json="{}",
                )

        rospy.loginfo("[JCC Agent] Received command '%s' with args %s", cmd, json.dumps(args))

        try:
            if cmd == "status":
                return self._cmd_status()
            elif cmd == "start_mapping":
                return self._cmd_start_mapping(args)
            elif cmd == "stop_mapping":
                return self._cmd_stop_mapping()
            elif cmd == "save_map":
                return self._cmd_save_map(args)
            elif cmd == "list_maps":
                return self._cmd_list_maps()
            elif cmd == "delete_map":
                return self._cmd_delete_map(args)
            elif cmd == "get_map_chunk":
                return self._cmd_get_map_chunk(args)
            else:
                return AgentCommandResponse(
                    success=False,
                    message="Unknown command '%s'. Supported: status, start_mapping, stop_mapping, save_map, list_maps, delete_map, get_map_chunk" % cmd,
                    payload_json="{}",
                )
        except Exception as e:
            rospy.logerr("[JCC Agent] Error executing '%s': %s", cmd, str(e))
            return AgentCommandResponse(
                success=False,
                message="Internal agent error: %s" % str(e),
                payload_json="{}",
            )

    # -------------------------------------------------------------------------
    # Command Implementations
    # -------------------------------------------------------------------------

    def _cmd_status(self):
        """Reports agent telemetry, mapping process status, and disk usage."""
        # Check mapping process state
        is_mapping = False
        pid = None
        if self.mapping_process is not None:
            ret = self.mapping_process.poll()
            if ret is None:
                is_mapping = True
                pid = self.mapping_process.pid
            else:
                self.mapping_process = None
                self.mapping_start_time = None

        # Check maps directory stats
        map_count = 0
        trash_count = 0
        if os.path.exists(self.maps_dir):
            for f in os.listdir(self.maps_dir):
                if f.endswith(".yaml"):
                    map_count += 1
        if os.path.exists(self.trash_dir):
            for f in os.listdir(self.trash_dir):
                if f.endswith(".yaml"):
                    trash_count += 1

        payload = {
            "version": AGENT_VERSION,
            "uptime_secs": int(time.time() - self.start_time),
            "is_mapping": is_mapping,
            "mapping_pid": pid,
            "mapping_duration_secs": int(time.time() - self.mapping_start_time) if self.mapping_start_time else 0,
            "maps_dir": self.maps_dir,
            "map_count": map_count,
            "trash_count": trash_count,
            "slam_pkg": self.slam_pkg,
            "slam_launch": self.slam_launch,
        }

        return AgentCommandResponse(
            success=True,
            message="Agent is operational.",
            payload_json=json.dumps(payload),
        )

    def _cmd_start_mapping(self, args):
        """Launches SLAM node via roslaunch with isolated process group."""
        if self.mapping_process is not None and self.mapping_process.poll() is None:
            return AgentCommandResponse(
                success=False,
                message="Mapping is already running with PID %d." % self.mapping_process.pid,
                payload_json=json.dumps({"pid": self.mapping_process.pid}),
            )

        pkg = args.get("pkg") or self.slam_pkg
        launch_file = args.get("launch") or self.slam_launch

        # Strict validation on launch arguments
        if not re.match(r"^[a-zA-Z0-9_\-]+$", pkg):
            return AgentCommandResponse(success=False, message="Invalid ROS package name.", payload_json="{}")
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", launch_file):
            return AgentCommandResponse(success=False, message="Invalid launch file name.", payload_json="{}")

        cmd = ["roslaunch", pkg, launch_file]
        rospy.loginfo("[JCC Agent] Starting SLAM: %s", " ".join(cmd))

        try:
            # preexec_fn=os.setsid creates an independent process group so SIGINT kills all child ROS nodes
            self.mapping_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid,
            )
            self.mapping_start_time = time.time()

            # Brief pause to verify the process did not immediately crash
            time.sleep(0.5)
            if self.mapping_process.poll() is not None:
                err_out = self.mapping_process.stderr.read()
                self.mapping_process = None
                return AgentCommandResponse(
                    success=False,
                    message="SLAM process exited immediately: %s" % err_out.decode("utf-8", "ignore")[:200],
                    payload_json="{}",
                )

            return AgentCommandResponse(
                success=True,
                message="Mapping process started successfully.",
                payload_json=json.dumps({"pid": self.mapping_process.pid}),
            )
        except Exception as e:
            self.mapping_process = None
            return AgentCommandResponse(
                success=False,
                message="Failed to spawn roslaunch: %s" % str(e),
                payload_json="{}",
            )

    def _cmd_stop_mapping(self):
        """Gracefully halts the mapping process group with SIGINT then SIGTERM."""
        if self.mapping_process is None or self.mapping_process.poll() is not None:
            self.mapping_process = None
            self.mapping_start_time = None
            return AgentCommandResponse(
                success=True,
                message="Mapping process was not running.",
                payload_json="{}",
            )

        pgid = os.getpgid(self.mapping_process.pid)
        rospy.loginfo("[JCC Agent] Stopping mapping process group %d (PID %d)...", pgid, self.mapping_process.pid)

        try:
            # 1. SIGINT to allow nodes to save buffers cleanly
            os.killpg(pgid, signal.SIGINT)

            # Wait up to 4 seconds for clean exit
            for _ in range(40):
                if self.mapping_process.poll() is not None:
                    break
                time.sleep(0.1)

            # 2. Fall back to SIGTERM if still lingering
            if self.mapping_process.poll() is None:
                rospy.logwarn("[JCC Agent] Process group %d did not terminate on SIGINT, sending SIGTERM...", pgid)
                os.killpg(pgid, signal.SIGTERM)
                time.sleep(0.5)

            self.mapping_process = None
            self.mapping_start_time = None

            return AgentCommandResponse(
                success=True,
                message="Mapping process stopped successfully.",
                payload_json="{}",
            )
        except Exception as e:
            return AgentCommandResponse(
                success=False,
                message="Error stopping mapping process: %s" % str(e),
                payload_json="{}",
            )

    def _cmd_save_map(self, args):
        """Saves current live OccupancyGrid via ROS map_saver."""
        map_name = args.get("name") or "map_%d" % int(time.time())
        ok, clean_name, target_base_path = self._resolve_map_path(map_name)
        if not ok:
            return AgentCommandResponse(success=False, message=clean_name, payload_json="{}")

        rospy.loginfo("[JCC Agent] Saving map to prefix: %s", target_base_path)

        cmd = ["rosrun", "map_server", "map_saver", "-f", target_base_path]
        try:
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = p.communicate()
            ret = p.returncode

            if ret != 0:
                err_msg = stderr.decode("utf-8", "ignore").strip() or stdout.decode("utf-8", "ignore").strip()
                return AgentCommandResponse(
                    success=False,
                    message="map_saver failed (code %d): %s" % (ret, err_msg[:200]),
                    payload_json="{}",
                )

            yaml_path = target_base_path + ".yaml"
            pgm_path = target_base_path + ".pgm"

            if not os.path.exists(yaml_path) or not os.path.exists(pgm_path):
                return AgentCommandResponse(
                    success=False,
                    message="map_saver returned success but output files are missing.",
                    payload_json="{}",
                )

            payload = {
                "name": clean_name,
                "yaml_path": yaml_path,
                "pgm_path": pgm_path,
                "yaml_size": os.path.getsize(yaml_path),
                "pgm_size": os.path.getsize(pgm_path),
                "saved_at": time.time(),
            }

            return AgentCommandResponse(
                success=True,
                message="Map '%s' saved successfully on robot." % clean_name,
                payload_json=json.dumps(payload),
            )
        except Exception as e:
            return AgentCommandResponse(
                success=False,
                message="Failed to execute map_saver: %s" % str(e),
                payload_json="{}",
            )

    def _cmd_list_maps(self):
        """Lists saved maps in maps_dir."""
        maps = []
        if os.path.exists(self.maps_dir):
            for fname in os.listdir(self.maps_dir):
                if fname.endswith(".yaml"):
                    base_name = fname[:-5]
                    yaml_path = os.path.join(self.maps_dir, fname)
                    pgm_path = os.path.join(self.maps_dir, base_name + ".pgm")

                    has_pgm = os.path.exists(pgm_path)
                    stat = os.stat(yaml_path)

                    maps.append({
                        "name": base_name,
                        "yaml_path": yaml_path,
                        "pgm_path": pgm_path if has_pgm else None,
                        "has_pgm": has_pgm,
                        "yaml_size_bytes": stat.st_size,
                        "pgm_size_bytes": os.path.getsize(pgm_path) if has_pgm else 0,
                        "modified_secs": stat.st_mtime,
                    })

        # Sort descending by modified time
        maps.sort(key=lambda m: m["modified_secs"], reverse=True)

        return AgentCommandResponse(
            success=True,
            message="Found %d saved maps on robot." % len(maps),
            payload_json=json.dumps({"maps": maps, "maps_dir": self.maps_dir}),
        )

    def _cmd_delete_map(self, args):
        """Safely moves map files to trash directory (non-destructive)."""
        map_name = args.get("name")
        ok, clean_name, target_base_path = self._resolve_map_path(map_name)
        if not ok:
            return AgentCommandResponse(success=False, message=clean_name, payload_json="{}")

        yaml_path = target_base_path + ".yaml"
        pgm_path = target_base_path + ".pgm"

        if not os.path.exists(yaml_path) and not os.path.exists(pgm_path):
            return AgentCommandResponse(
                success=False,
                message="Map '%s' not found on robot." % clean_name,
                payload_json="{}",
            )

        timestamp_suffix = "_deleted_%d" % int(time.time())
        moved_files = []

        try:
            if os.path.exists(yaml_path):
                dest = os.path.join(self.trash_dir, clean_name + timestamp_suffix + ".yaml")
                shutil.move(yaml_path, dest)
                moved_files.append(dest)

            if os.path.exists(pgm_path):
                dest = os.path.join(self.trash_dir, clean_name + timestamp_suffix + ".pgm")
                shutil.move(pgm_path, dest)
                moved_files.append(dest)

            return AgentCommandResponse(
                success=True,
                message="Map '%s' moved to trash." % clean_name,
                payload_json=json.dumps({"name": clean_name, "moved_to_trash": moved_files}),
            )
        except Exception as e:
            return AgentCommandResponse(
                success=False,
                message="Failed to move map to trash: %s" % str(e),
                payload_json="{}",
            )

    def _cmd_get_map_chunk(self, args):
        """Reads a chunk of a map file (.pgm or .yaml) in base64 encoding."""
        map_name = args.get("name")
        file_ext = (args.get("ext") or "yaml").strip().lower()
        chunk_idx = int(args.get("chunk_index") or 0)

        if file_ext not in ("yaml", "pgm"):
            return AgentCommandResponse(success=False, message="Invalid file extension. Use 'yaml' or 'pgm'.", payload_json="{}")

        ok, clean_name, target_base_path = self._resolve_map_path(map_name)
        if not ok:
            return AgentCommandResponse(success=False, message=clean_name, payload_json="{}")

        filepath = target_base_path + "." + file_ext
        if not os.path.exists(filepath):
            return AgentCommandResponse(
                success=False,
                message="File '%s' not found." % os.path.basename(filepath),
                payload_json="{}",
            )

        total_size = os.path.getsize(filepath)
        total_chunks = max(1, (total_size + CHUNK_SIZE_BYTES - 1) // CHUNK_SIZE_BYTES)

        if chunk_idx < 0 or chunk_idx >= total_chunks:
            return AgentCommandResponse(
                success=False,
                message="chunk_index %d out of bounds (0..%d)." % (chunk_idx, total_chunks - 1),
                payload_json="{}",
            )

        try:
            with open(filepath, "rb") as f:
                f.seek(chunk_idx * CHUNK_SIZE_BYTES)
                chunk_bytes = f.read(CHUNK_SIZE_BYTES)

            encoded_data = base64.b64encode(chunk_bytes).decode("ascii")

            payload = {
                "name": clean_name,
                "ext": file_ext,
                "chunk_index": chunk_idx,
                "total_chunks": total_chunks,
                "total_size_bytes": total_size,
                "chunk_size_bytes": len(chunk_bytes),
                "is_last_chunk": (chunk_idx == total_chunks - 1),
                "data_base64": encoded_data,
            }

            return AgentCommandResponse(
                success=True,
                message="Chunk %d/%d retrieved." % (chunk_idx + 1, total_chunks),
                payload_json=json.dumps(payload),
            )
        except Exception as e:
            return AgentCommandResponse(
                success=False,
                message="Failed to read file chunk: %s" % str(e),
                payload_json="{}",
            )


if __name__ == "__main__":
    try:
        agent = JccAgentNode()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
