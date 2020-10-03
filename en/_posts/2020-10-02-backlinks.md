---

title: Building a Framework for Federated Networks
summary: Using Relational Databases, Django and ActivityStreams

header_image: '/assets/img/post_headers/sky.jpg'
---

Late 2019 I started working on [DjangoLDP](https://git.startinblox.com/djangoldp-packages/djangoldp), built upon Django Rest Framework to provide its users with a means to create interoperable, [Linked-Data](https://www.w3.org/TR/ldp/) Django applications ready for the semantic web. In short, federation is the connecting of multiple server instances so that the service provided to the user is consistent across multiple peers and databases, potentially using different technologies and structures. It allows us to build a **decentralised** platform over a community, taking power away from monopolies and giving it back to the users.

In the build-up to the release of version 0.7, we have been working on a system for instances to keep their peers up-to-date and provide consistency in a federated network.

Imagine that we have a federated network consisting of two servers, Paris and Nantes:

<img src="{{ '/assets/img/post_assets/backlinks/1.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">figure 1: Paris and Nantes</p>

Each of these instances serve a [Startin'Blox](https://startinblox.com/en/) application to users, a front-end framework which pulls in federated resources and serves these to the user. Now take for example that we have the following Django models:

```python
from django.conf import settings
from djangoldp.models import Model
from djangoldp_account.models import LDPUser # a federation-ready user model

class Circle(Model):
    # ...

class CircleMember(Model):
    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="circles")
    
```

I have a user, Bob, which has an account on Paris. He's a member of a bunch of Circles on Paris with his friends, but he's just found a super-cool Circle on Nantes, and he's decided to spread his social wings a bit:

<img src="{{ '/assets/img/post_assets/backlinks/2.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">figure 2: Bob joins a circle in Nantes</p>

Nantes is able to authenticate Bob's Parisian token using our built-in [OIDC](https://auth0.com/docs/protocols/oidc) provider, and it adds Bob to the circle as he requested. However, Bob's account, nested in Paris, has no idea that he's a member of this circle! When Startin'Blox pings a request to https://paris.startinblox.com/users/bob/circles/, the Nantes circle is not listed! And so Nantes needs to let Paris know of this event. Our solution will need to be based on the DjangoLDP `Model`, so that the same code will detect and notify Paris of a reference to Circle, CircleMember, and any other kind of linked data.

## Step 1: The Request

Nantes is able to detect that it has something to say to Paris because a user with a Parisian urlid (https://paris.startinblox.com/users/bob/) has been connected to a local resource. From here it is able to discover Bob's inbox (see the [Linked Data Notifications spec](https://www.w3.org/TR/ldn/))

<img src="{{ '/assets/img/post_assets/backlinks/3.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">figure 3: Nantes sends Paris a backlink</p>

For the content of the notification, we use the [ActivityStreams](https://www.w3.org/TR/activitystreams-vocabulary/) format, which allows for a common language describing interactions between Objects. To define the object we use an [Resource Description Framework (RDF) ontology](https://www.w3.org/RDF/), which allows us to describe the semantics of the objects we're sending. For example encoded in the `"@type": "hd:circle"` is a reference to an RDF document (which we would reference in the `@context`) describing the properties which make up a circle. In this way we can use RDF to link applications together who may store circles in different ways, but agree at least on what a 'circle' is. The recipient might not even be using DjangoLDP at all!

```python
{
  "@context": [...],
  "summary": "A circle member was created",
  "type": "Create",
  ...
  "object": {
    "@type": "hd:circlemember",
    "@id": "https://nantes.startinblox.com/circle-members/1/",
    "user": {
      "@type": "foaf:user",
      "@id": "https://paris.startinblox.com/users/1/"
    },
    "circle": {
        "@type": "hd:circle",
        "@id": "https://nantes.startinblox.com/circles/1/"
    }
  }
  ...
}
```
(An Activity in [JSON-LD](https://json-ld.org) format)

The request here is generated with a function `build_object_tree`, which constructs the type and id of the base object, before doing the same for each linked object (to a depth of one). Our receiver can handle trees with a greater depth however, thanks to a recursive function which we'll get to later. By the ActivityStreams standard, we could also have sent the object serialized with just a urlid, `"object": "https://nantes.startinblox.com/circle-members/1/"`, and the Paris server could deduce its relationships by making a GET request on the resource

## Step 2: The Receiver

Bob's inbox, provided by the `InboxView` on the Paris server, has now received the activity from Nantes. The basic pipeline of parsing an activity is as follows:

1. validate the Activity
2. parse the Activity, and implement the necessary changes
3. respond 201, with the saved Activity in the `Location` header of the response

### Validate the Activity

Activity validation consists of three parts:
* _authentication_ (that the server who is sending the activity is who they say they are)
* _authorisation_ (server Toulouse should not be able to claim to have created a Nantes circle-member)
* validation of required fields and their content (as defined by the ActivityStreams specification)

### Parse the Activity

The fun part is the parsing of the activity. In DjangoLDP the `InboxView` contains various logic for handling different kinds of activity. Under the hood, the star of the show is a recursive function `get_or_create_nested_backlinks`, which, given a nested tree of objects, will recursively resolve each node, getting an existing backlink if possible, or creating one. It is wrapped in an atomic operation so that everything is completed successfully, or nothing, in the case of an error.

```python
for item in obj.items():
  ...
  item_model = Model.get_subclass_with_rdf_type(item_value['@type'])
  ...

  # push nested object as a branch
  backlink = self._get_or_create_nested_backlinks(item_value, item_model)
  branches[item[0]] = backlink
```

This essentially reconstructs the tree of sub-objects (sent in JSON) into a tree of Django objects which we know how to deal with. With this, the function makes a call to `get_or_create` the referenced top-level object (for this depth of recursion), and returns the associated instance. `get_or_create_external` is just a variation of this, which throws an `ObjectDoesNotExist` exception if it's passed a local object which does not exist (Nantes should not be able to invent Parisian resources!)

```python
# get or create the backlink
try:
  external = Model.get_or_create_external(object_model, obj['@id'], update=update, **branches)

  # creating followers, to inform distant resource of changes to local connection
  if Model.is_external(external):
    # this is handled with Followers, where each local child of the branch is followed by its external parent
    for item in obj.items():
      ...
      if not Model.is_external(urlid):
        ActivityPubService.save_follower_for_target(external.urlid, urlid)

  return external

# this will be raised when the object was local, but it didn't exist
except ObjectDoesNotExist:
  raise Http404()
```

The middle chunk of code here handles the creating of `Follower`s for the sender's resources. A follower is an inbox subscribing to the resource, who would like to be notified of future changes to its connections. In our example, Paris wanted to know that Bob had joined a distant circle, but if Bob deletes his account, Nantes will also need to be informed that he should be removed from their circle.

## The Result

Parisian Bob can now be happy in the knowledge that using one applicaiton he can access his circles in Paris, Nantes, London and New York. Using the right front-end application he could also access his social media posts from a totally unrelated service. It's all thanks to the power of semantic web standards like Linked Data Protocol and ActivityStreams.

I've outlined in this dev diary how federation works in version 0.7 of DjangoLDP. At the time of publishing it's a little outdated and we have some swanky new systems :-)

In a future blogpost I'll show off a new `ActivityQueueService`, an asynchronous Activity queue which we use to protect the federation from inconsistencies (e.g. what if Paris is offline when Bob joins a circle in Nantes?)
