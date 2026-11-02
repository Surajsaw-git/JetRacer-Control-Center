cmake_minimum_required(VERSION 3.0.2)
project(jetracer_cc_agent)

find_package(catkin REQUIRED COMPONENTS
  rospy
  jetracer_cc_msgs
  std_msgs
)

catkin_package(
  CATKIN_DEPENDS rospy jetracer_cc_msgs std_msgs
)

catkin_install_python(PROGRAMS
  scripts/jcc_agent.py
  DESTINATION ${CATKIN_PACKAGE_BIN_DESTINATION}
)
