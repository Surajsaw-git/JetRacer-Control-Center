"""Live end-to-end smoke verification script for Phase 2 backend."""

import asyncio
import json
import sys

import httpx
import websockets


async def run_smoke_test(
    base_url: str = "http://127.0.0.1:8000", ws_url: str = "ws://127.0.0.1:8000/api/v1/ws"
) -> None:
    print("=" * 60)
    print("JetRacer Control Center — Live Backend Smoke Verification")
    print("=" * 60)

    async with httpx.AsyncClient(base_url=base_url) as client:
        # 1. Test /api/health
        print("\n[1/5] Probing Liveness Endpoint (/api/health)...")
        r_health = await client.get("/api/health")
        assert r_health.status_code == 200, f"Health check failed: {r_health.status_code}"
        health_data = r_health.json()
        print(f"  [OK] Status: {health_data['status']}, Version: {health_data['version']}")

        # 2. Test /api/health/ready
        print("\n[2/5] Probing Readiness Endpoint (/api/health/ready)...")
        r_ready = await client.get("/api/health/ready")
        assert r_ready.status_code == 200, f"Readiness check failed: {r_ready.status_code}"
        ready_data = r_ready.json()
        assert ready_data["status"] == "ready"
        assert ready_data["components"]["robot"]["status"] == "not_integrated"
        print(f"  [OK] Readiness: {ready_data['status']}")
        print(f"  [OK] Robot Status (Honest): {ready_data['components']['robot']['status']}")

        # 3. Test /api/v1/info
        print("\n[3/5] Probing Metadata Endpoint (/api/v1/info)...")
        r_info = await client.get("/api/v1/info")
        assert r_info.status_code == 200, f"Info check failed: {r_info.status_code}"
        info_data = r_info.json()
        print(f"  [OK] App Name: {info_data['app_name']}")
        print(f"  [OK] Platform: {info_data['platform']}")
        ros_cap = info_data['capabilities']['ros']
        print(f"  [OK] ROS capability: {ros_cap['status']} (Phase {ros_cap['planned_phase']})")

    # 4. Test WebSocket Multiplexer
    print("\n[4/5] Testing Live WebSocket Protocol (/api/v1/ws)...")
    async with websockets.connect(ws_url) as ws:
        # Welcome
        raw_welcome = await ws.recv()
        welcome = json.loads(raw_welcome)
        assert welcome["type"] == "welcome", f"Expected welcome, got {welcome}"
        conn_id = welcome["payload"]["connection_id"]
        print(f"  [OK] Connected! Welcome received (conn_id: {conn_id})")

        # Ping / Pong
        print("  - Testing Ping / Pong...")
        await ws.send(json.dumps({"type": "ping", "id": "smoke-ping-1"}))
        raw_pong = await ws.recv()
        pong = json.loads(raw_pong)
        assert pong["type"] == "pong" and pong["id"] == "smoke-ping-1"
        print("  [OK] Pong received with matching ID")

        # Channel Subscription
        print("  - Testing Subscription to 'system' channel...")
        await ws.send(json.dumps({"type": "subscribe", "channel": "system", "id": "smoke-sub-1"}))
        raw_sub = await ws.recv()
        sub = json.loads(raw_sub)
        assert sub["type"] == "subscribed" and sub["channel"] == "system"
        print("  [OK] Subscribed to channel 'system'")

        # Echo Test
        print("  - Testing Echo Utility Frame...")
        await ws.send(json.dumps({"type": "echo", "id": "smoke-echo-1", "payload": {"test": "ok"}}))
        raw_ack = await ws.recv()
        ack = json.loads(raw_ack)
        assert ack["type"] == "ack" and ack["payload"]["echo"] == {"test": "ok"}
        print("  [OK] Echo acknowledged with matching payload")

    # 5. Summary
    print("\n[5/5] Verification Complete")
    print("=" * 60)
    print("ALL LIVE SMOKE TESTS PASSED (HTTP + WebSocket Protocol Green)")
    print("=" * 60)


if __name__ == "__main__":
    try:
        asyncio.run(run_smoke_test())
    except Exception as e:
        print(f"\n[FAIL] Smoke verification failed: {e}")
        sys.exit(1)
