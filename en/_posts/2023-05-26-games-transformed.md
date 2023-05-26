---

title: A Card Game Created by Commoners at Large
summary: Our submission to the Games Transformed 2023 Game Jam
lang: en
lang-ref: games-transformed-2023

header_image: '/assets/img/post_headers/games-transformed-2023.png'
---

The Commons is property that opens itself up to use by anyone, and which is owned and managed by the people who use it... So what would that mean when talking about game development?

Hello! I'd like to introduce you to our Games Transformed submission, Realm. In the spirit of anti-capitalist game jams and collective action, we hope to convince you that there is potential in building a Games Commons - Wikipedia for games. Following on from past experiments, in this game players submit their own characters to be played as cards using an open standard which can be interoperable with other games. I'll get back to this, for now the best way to show you this is for you to play it.

Please start by making a card at the following URL: [https://mud-card-generator.netlify.app/](https://mud-card-generator.netlify.app/). Please use images that are 512x512 (sorry, we ran out of time!)

<img src="{{ '/assets/img/post_assets/games-transformed-2023/card-generator.png' | absolute_url }}" class="blog-full-image" alt="A screenshot of the card creation process" />

Hit save - and it's in the game! (yeah really, please don't hack us)

If you're at the event, give it a go on the arcade machine, or if you're at home then give it a go in the browser from the [Itch.io page (https://calummackervoy.itch.io/realm)](https://calummackervoy.itch.io/realm).

<img src="{{ '/assets/img/post_assets/games-transformed-2023/player-selection.png' | absolute_url }}" class="blog-full-image" alt="A screenshot of the player selection screen" />

In the game you choose to give cards to the deck of one AI player or the other, then battle ensues. You might notice that some of the stuff that happens is unexpected, like a Bog Monster eating villagers from a place called Withering Heights or a knight deciding to pack it in and become a teacher. These actions happen because the characters are interacting with their world and have actions and events defined on them which impact the wider world. Everything being in linked data, the game can enact changes like eating villagers in the correct way even though it doesn't really know what that is. Last month I demonstrated how this works by [turning a character into a vampire, in a game that wasn't designed to know what a vampire is](https://calum.mackervoy.com/en/2023/04/03/mud-demo.html).

<img src="{{ '/assets/img/post_headers/games-transformed-2023.png' | absolute_url }}" class="blog-full-image" alt="A screenshot of the game" />

If you enjoyed making a card for the game and you're wondering how you can add to and enrich your character, or how you can add more complex spells and actions like eating nearby villagers, at this stage you'll need to get your hands dirty with writing JSON. If you're not scared away, then check out out the [documentation for creating cards](https://github.com/Multi-User-Domain/games-transformed-jam-2023/blob/master/docs/create.md). Don't be afraid to ask for help!

Hopefully now I've shed some light on what is meant by a "game in common" - the features, characters and worlds can be shared, and games can mutually benefit from doing so. It has the potential to be a free space, a Wikipedia for games. For this jam we kept the scope to a simple card game, but in later jams we plan to expose your characters to [text adventure games](https://calum.mackervoy.com/en/2022/08/26/ud-engine.html), and allow you to use them across games in interesting, cross-polinating ways. The idea can be taken much, much further.

Everything in our commons open source, if you're interested in following this project into the future and _especially_ if you're interested in contributing, then please let us know and [join our Discord server](https://discord.gg/sauZA3jCK7). We're interested in making decent technology which empowers the people who use it, following the principles laid out by [Technostructures](https://technostructures.org/en/fronts/technologie-that-empowers/).
