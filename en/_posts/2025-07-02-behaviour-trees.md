---

title: Game AI Designed to Surprise
summary: Collaborative Behaviour Trees in a Games Commons
lang: en
lang-ref: commons-behaviour-trees

header_image: '/assets/img/post_headers/03.jpg'
---

The Commons is property that opens itself up to use by anyone, and which is owned and managed by the people who use it... So what would that mean when talking about game development?

For the past couple of years I've been working on the concept of a [Games Commons](https://gamescommons.com/), which is a new way of designing games that centres around flexibility, collaboration and the concept of Do-It-Together. These are games built around a creative community of hackers, like Wikipedia but for game content.

Our flagship project is a game about making and breaking social systems using creative powers. Social systems are made up of networked agents that are running AI scripts built by the player, and shared in common by the community. The design of the tools which enable the player to create and collaborate on such scripts is the subject of today's article.

An AI agent in games is always essentially running an algorithm; a script directing their interface with the game world. The AI could be a peer of the human player, working with or against them. At the other extreme the agent may be there simply to decorate the world and make it believable. Usually a single game will employ several different kinds of AI, working towards different goals. It may even use different AI methods to achieve those goals. "Good game AI" is therefore not necessarily AI which is complicated; it's AI which is appropriate to the objectives of the game designer with the agent that is deploying it.

In our case we need to design a data structure which can be used to represent an AI script, and the in-game tools which can be used by the player to create and share such scripts. As such, for now at least, we have chosen a "one size fits all" approach to AI: a single approach that is flexible enough to be used by our game for competitive agents as well as decorative ones.

For this purpose we have proposed using a data-driven version of **Behaviour Trees**, which are essentially flowcharts that direct the decisions to be made and the actions taken by an agent. A simple behaviour tree might feature the **control** node "is the agent hungry?". If the agent is hungry, it would execute the action node: "eat something". If the agent is not hungry, it would follow the other side of the tree.

<img src="{{ '/assets/img/post_assets/behaviour-trees/behaviour_tree_example.png' | absolute_url }}" class="blog-centred-image" alt="A flowchart displays a control node, 'hungry?'. One branch (yes) feeds into the action node, 'eat'. A second branch (no) feeds into another control node, labelled '...' to illustrate that in this case the tree continues" />

The result of the above tree is that hunger is prioritised. If the agent is not hungry, then the flow continues. We can imagine a situation where (relieved of hunger) the agent is free to subsequently pursue a more whimsical chain of behaviours:

<img src="{{ '/assets/img/post_assets/behaviour-trees/wander_shout.png' | absolute_url }}" class="blog-full-image" alt="In a second example, the flowchart leads through two action nodes; wander and shout. These nodes are followed by a new type of node, a mutate node, which is labelled 'destroy branch'. Finally we have a control node signifying that the tree continues">

In the example above the agent will wander, and then shout. This branch of the tree finishes with a **forget** node, a special kind of control node for permanently modifying the behaviour tree itself. Execution of this node will destroy the wander-shout sub-branch, since the behaviour should be executed once - it was intended to be whimsical; a moment of madness. It also demonstrates that behaviour trees are _modular_; we can imagine the wander-shout branch being sufficient to define the entire behaviour tree of a _raving lunatic_, but for another agent we could plug in the same branch as just one aspect of their behaviour:

<img src="{{ '/assets/img/post_assets/behaviour-trees/learning.png' | absolute_url }}" class="blog-full-image" alt="In this example both previous examples are pulled together. There is a condition, 'drunk?' which triggers the wander, shout and forget nodes, rendered smaller to indicate that they are a module that has been imported. This branch leads into a new behaviour, labelled 'learn'. If the agent is not drunk then the chart flows into the hunger tree from the first example, also imported">

If the agent is drunk, they wander, shout and forget, before executing a new node, "learn". If the player is not drunk, the chart moves on to the hunger condition from the first example. We can see here how the behaviours wander-shout-forget, and hunger-eat, have been packaged into branches. Once packaged, they can be re-used by their creator in the behaviour trees of different agents, and published online with some metadata about what the branch does. Once published online other players can import the behaviour into their own agents, which is already a powerful mechanism for building a games commons. Further from this we have the "learn" node, which with the right metadata, can use search parameters for the agent to discover a new drunken behaviour online from the games commons. The next time this tree executes and the agent is still drunk, he will have forgotten the wander-shout behaviour but may discover a behaviour someone has published on the games commons that causes him to fall over and begin singing.

The fact that the nodes on our behaviour trees are driven by data that can be published and then discovered _at run time_ allows for the emergence of spontaneous and unique behaviour that isn't conceivable in traditional game design. We can imagine a situation where our player's agent, hitherto a hunter and a cave man, has a moment of inspiration which allows them to learn the carving of bones into religious statues, and after hunting they begin to perform increasingly elaborate religious ceremonies. We quickly begin to see the flexibility of the behaviour tree system, but this also provides a powerful illustration of what is a _Games Commons_: another player lovingly created the process of tribalistic religious ceremonies, and in the publishing opened the possibility of everyone in the community to discover and experience them. The game evolves, driven by the creativity of its player base.
