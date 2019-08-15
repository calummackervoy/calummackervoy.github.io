---
identifier: dissertation
title: Dissertation
website: https://gitlab.com/calummackervoy/goap-igpu

image_count: 0

paras:
    - Used OpenCL to produce a distributed version of Goal Oriented Action Planning (GOAP). GOAP essentially uses Dijkstra/A* in decision making AI, to find the most efficient path to reaching a goal/ideal state (usually to win a game).
    - The software was deployed on the iGPU and GPU devices with each core acting as a single agent.
    - It was found that running the AI on the (normally unused) iGPU greatly improved the performance of the test simulation, compared to tests running AI on the CPU or GPU.

tags:
    - Game
    - Desktop
    - GPU
    - AI
    - C/C++
---
