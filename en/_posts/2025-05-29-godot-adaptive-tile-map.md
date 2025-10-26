---

title: Adaptive Tile Maps in Godot
summary: Blending Terrain Sets dynamically
lang: en
lang-ref: godot-adaptive-tile-map

header_image: '/assets/img/post_headers/godot.png'
---

2D game worlds are constructed of several different types of terrain, of grass and water and firey lava. Since time-immemorial, top-down 2D classics like Pokémon have stored such data in _terrain maps_, essentially an array of integers representing the game map. In a very simple example we can imagine building a tile set of black and white squares, like a chess board:

<div class="row">
<div class="col-1 col-lg-2"></div>
<div class="col-5 col-lg-4">
<div class="language-json highlighter-rouge"><div class="highlight"><pre class="highlight"><code><span class="p">[</span><span class="w">
    </span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="w">
    </span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="w">
</span><span class="p">]</span><span class="w">
</span></code></pre></div></div>
</div>
<div class="col-5 col-lg-4">
<img class="pt-3 blog-full-image-vertical" src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/chess-board.png' | absolute_url }}" alt="An image of a black-and-white grid, a chessboard" />
<p class="image-caption" aria-hidden="true">The array rendered, where 0 is white and 1 is black</p>
</div>
<div class="col-1 col-lg-2"></div>
</div>

Of course, in most games we would prefer not to have such harsh lines between each tile on our board. Often we want our terrain map to include several kinds of terrain and crucially to include some blending between each type of terrain:

<div class="row">
<div class="col-1 col-lg-2"></div>
<div class="col-5 col-lg-4">
<div class="language-json highlighter-rouge"><div class="highlight"><pre class="highlight"><code><span class="p">[</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">0</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="w">
    </span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="p">,</span><span class="mi">1</span><span class="w">
</span><span class="p">]</span><span class="w">
</span></code></pre></div></div>
</div>
<div class="col-5 col-lg-4">
<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/terrain-map-example.png' | absolute_url }}" class="pt-2 blog-full-image-vertical" alt="A screenshot of the 2D map rendered: a pond surrounded by grass" />
</div>
<div class="col-1 col-lg-2"></div>
</div>

Obtaining such a result involves creating a _tile set_ for each type of tile on the map, here we have water and grass. Instead of creating a single tile for grass and water that blends like the black and white of a chess board, we create many tiles for each tile type, blended with the different surrounding terrains. Take the example below:

<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/grass-water.png' | absolute_url }}" class="blog-full-image-vertical" alt="A set of tiles, 32x32, featuring many different versions of water and grass: one water tile, one grass tile, and many different versions where water is bordered by grass on different sides" />

In our game we will then select the tile to display based on the surrounding tiles. If the tiles to the right of this one are grass - but all other tiles are water, we will draw a version of the water with a grassy verge to the left, like in the tile highlighted below:

<div class="row">
<div class="col-1 col-lg-2"></div>
<div class="col-5 col-lg-4">
<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/terrain-map-example-2.png' | absolute_url }}" class="blog-full-image-vertical" alt="A screenshot of the game map with a grassy verge highlighted by a red box" />
</div>
<div class="col-5 col-lg-4">
<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/grass-water-2.png' | absolute_url }}" class="blog-full-image-vertical" alt="An image of the tileset with the corresponding tile to the grassy verge highlighted by a red box" />
</div>
<div class="col-lg-3"></div>
</div>

Another water tile is surrounded by water, so for this one we select the corresponding "full-water" tile:

<div class="row">
<div class="col-1 col-lg-2"></div>
<div class="col-5 col-lg-4">
<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/terrain-map-example-3.png' | absolute_url }}" class="blog-full-image-vertical" alt="A screenshot of the game map with a water tile highlighted by a red box" />
</div>
<div class="col-5 col-lg-4">
<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/grass-water-3.png' | absolute_url }}" class="blog-full-image-vertical" alt="An image of the tileset with the full-water tile highlighted by a red box" />
</div>
<div class="col-1 col-lg-2"></div>
</div>

## Tile Maps in Godot

Whilst classic games such as the early Pokémon games were built from scratch, nowadays aspiring game developers can use an engine to get up to speed faster and leverage existing tools for common games development needs.

[Godot](https://godotengine.org/) is an open-source game engine for producing both 2D and 3D games, and using the [TileMap](https://docs.godotengine.org/en/stable/classes/class_tilemap.html) node from the 2D engine we can draw 2D maps of terrains like the one above. Going into detail about how you can do this with a standard terrain set is not the purpose of this article, but suffice to say that it involves configuring essentially the process outlined in this article. The developer can create the appropriate terrain map PNGs, configure the map, and provide the array of terrains that define the pond:

```json
[
    1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,1,
    1,1,1,1,1,1,1,1
]
```

Then the engine does the heavy lifting: selecting the correct tile to display, etc, and the developer can get back to the fun stuff. If you're looking for a tutorial on how to set this up, there is a concise one covering the use of tilemaps in a top-down 2D game available [here](https://www.sandromaglione.com/articles/top-down-grid-movement-in-godot-game-engine). The Godot documentation also has a tutorial on [Using TileMaps](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html).

## Blending with unknown tile types

I'm working on a game which is data-driven. Players are able to publish their own content, including for example map regions with custom tile types like lava or sand, not necessarily prepared in advance for the default levels. The tiles, downloaded from the web, aren't known in advance and we therefore can't prepare blended tilesets for every tile type in advance. We want to allow plauers to draw a new terrain like lava and drop it into their map at **run-time**, i.e. without modifying the game files or needing to consider how it blends with grass. We want to be able to do this without giving up on blending altogether, or accepting the harsh borders like a chess board.

The solution is fairly simple: we will place each tile type on its own layer, and we'll prepare only one tile set for each terrain: blending the tile with transparent space:

<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/lava.png' | absolute_url }}" class="blog-full-image-vertical" alt="A tile map featuring a lava tile, where the lava blends with white-space instead of with a second tile" />
<p class="image-caption" aria-hidden="true">Much like our previous example, but here the lava tile is blending with empty space.</p>

By using a standard tileset layout like this, we can adapt a standard tileset configuration file (`.tres`), removing this workload from the creator. Representing the world data in JSON, the configuration of a new terrain type becomes trivial:

```json
{
    // ...
    "terrainTypes": [
        {
            "data": "https://simpolis.gamescommons.com/assets/tileset/Water.tres",
            "name": "Water",
            "solidity": 0,
            "hot": 0
        },
        {
            "data": "https://simpolis.gamescommons.com/assets/tileset/Grass.tres",
            "name": "Grass",
            "solidity": 5,
            "hot": 1
        },
        {
            "tileset": "https://simpolis.gamescommons.com/images/7c8febe6-1484-4b23-91be-7b290234821e.png",
            "name": "Lava",
            "solidity": 0,
            "hot": 10
        },
    ],
    "terrainLayers": [
        [
            1,1,1,1,1,1,1,1,
            1,0,0,0,0,0,0,1,
            1,1,1,1,1,1,1,1,
            1,2,2,2,2,2,2,1,
            1,2,2,2,2,2,2,1,
            1,1,1,1,1,1,1,1
        ]
    ]
}
```

Accepting a `tileset` data-type, the player can upload their custom terrain set, with the appropriate data properties like `hot`, which can be used to control behaviour. The game parses this data and builds the necessary game assets, completing them and saving them for future use. Thus, the player is able to upload a custom terrain type like lava into their world, in a game which wasn't built to understand what lava is:

<img src="{{ '/assets/img/post_assets/godot-adaptive-tile-map/terrain-map-example-4.png' | absolute_url }}" class="blog-full-image-vertical" alt="The rendered map, including the new-defined lava tiles along the bottom edge" />

## Games Commons

The concept of building a game piloted by the data published by its own players is an exciting one. Done well, the game becomes limitless and even alive: evolving with the collective efforts of the players. A game built in common is a [Games Commons](https://gamescommons.com/), and while in this demonstration we have been principally concerned with straightforward graphical elements, the idea constitutes a novel approach to game design that has far-reaching implications.

If this article has piqued your interest and you'd like to hear more about the concepts covered or more broadly about the project - or if you're interested by Godot and open-source games development - then don't hesitate to <a href="{{ '/contact' | prepend: site.baseurl }}">get in touch</a>!
