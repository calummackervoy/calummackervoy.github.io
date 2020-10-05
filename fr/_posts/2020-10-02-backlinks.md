---

title: La Construction d'un Framework pour les Reseaus Fédéré
summary: En Utilisant des Bases de Données Relationelles, Django et ActivityStreams
lang: fr
lang-ref: backlinks

header_image: '/assets/img/post_headers/sky.jpg'
---

Novembre 2019 j'ai débuté travailler sur [DjangoLDP](https://git.startinblox.com/djangoldp-packages/djangoldp), c'est un framework qui repose sur Django Rest Framework et permet à notre utilisateurs de créer des applications Django interiopérable, avec les standardes de [Linked-Data Protocol](https://www.w3.org/TR/ldp/) (LDP). Du coup, le fédération est le connexion des serveurs qui utilisent les stacks différents avec une protocol standarde, afin que le service soit le même pour tous. On peut construire un web **décentralisé**, en revendiquant le pouvoir des monopoles et le restituant aux utilisateurs.

Pour la publication de la version 0.7, nous travaillions sur une système permettant les instances de tenir leurs pairs au courant, pour fournir la cohérence dans un réseau fédéré.

Imaginez que nous avons un réseau qui consiste de deux serveurs, "Paris", et "Nantes":

<img src="{{ '/assets/img/post_assets/backlinks/1.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">chiffre 1: Paris et Nantes</p>

Les deux fournissent une application [Startin'Blox](https://startinblox.com/fr/), qui est un framework front-end pour servir les resources fédérés à l'utilisateur. Par example, si nous avons les modèles suivant:

```python
from django.conf import settings
from djangoldp.models import Model

class Circle(Model):
    # ...

class CircleMember(Model):
    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="circles")
    
```

Il y a un utilisateur, Bob, qui a une compte avec Paris. Il est une membre de plusiers Cercles sur Paris avec ses amis. Il vien de trouver un Cercle super cool de Nantes, et il veut le rejoindre

<img src="{{ '/assets/img/post_assets/backlinks/2.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">chiffre 2: Bob rejoind un cercle de Nantes</p>

Nantes peut authentifier le jeton Parisien de Bob en utilisant le fournisseur [OIDC](https://auth0.com/docs/protocols/oidc), et il ajoute Bob comme il a demandé. Mais son compte, stocké à Paris, n'a aucune idée que il est un membre de cet cercle! Quand Startin'Blox envoye un demande à https://paris.startinblox.com/users/bob/circles/, le nouveau cercle de Nantes ne serait pas enregistré ici! Donc il faut que Nantes fait-savoir Paris de cet evenemnent.

Nous trouverions un solution qui utilise le DjangoLDP `Model`, afin de le même code marche avec tous les modèles connecté.

## Étape 1: La Demande

Nantes est capable de détecter qu'il a besoin de notifier Paris, parce qu'un utilisateur avec un `urlid` Parisien (https://paris.startinblox.com/users/bob/) a été connecté à une resource locale.

<img src="{{ '/assets/img/post_assets/backlinks/3.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">figure 3: Nantes a envoyé Paris un activité</p>

Pour le contenu de la notification, on utilise le format de [ActivityStreams](https://www.w3.org/TR/activitystreams-vocabulary/), qui fournit un langage commun pour décrire les actions entre différents objets. On utilise aussi une ontologie du [Resource Description Framework (RDF)](https://www.w3.org/RDF/), pour partager les donées sémantiques avec nos pairs. Par example, encodée dans `"@type": "hd:circle"` est une référence d'un document RDF (qui nous réferencons dans le champ `@context`) pour décrire les propriétés qui composent un cercle. De cette façon, on peut utiliser RDF pour connecter les applications qui peut stocker les cercles avec plusiers différentes manières, mais peuvent au moins convenir de ce qu'est un cercle. Il peut-être le récepteur n'utilise pas du tout DjangoLDP!

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
(Un Activité en format [JSON-LD](https://json-ld.org))

La demande celui-ci est crée par un fonction `build_object_tree`, qui construit le type et id de l'objet en bas, avant d'en répéter pour ses enfants.

## Étape 2: Le Récepteur

Le `inbox` de Bob, fournit par le `InboxView` de le serveur Parisien, a maintenant reçu la Activity de Nantes. L'analyse d'une Activity se déroule comme suit :

1. validez la Activity
2. analysez la Activity, en faisant les changements nécessaire
3. répondez 201, avec la Activity enregistrée dans le header `Location` du réponse

### Validez la Activity

le validation de la Activity se compose de 3 parties :

* _authentification_ (validez que le serveur est celui qu'il prétend)
* _authorisation_ (Toulouse n'est pas capable de créer un cercle nantais)
* validez les champs nécessaires et le contenu

### Analysez la Activity

La partie le plus amusant est l'analyse de la Activity. En DjangoLDP le `InboxView` se compose de les fonctions pour recevoir des différents types d'Activity. Mais dans le code, la star du spectacle est la fonction récursive `get_or_create_nested_backlinks`, qui analyserai un arbre de les objets et récursivement évalue chaque feuille par chercher un backlink existent ou en créer un nouveau.

```python
for item in obj.items():
  ...
  item_model = Model.get_subclass_with_rdf_type(item_value['@type'])
  ...

  # push nested object as a branch
  backlink = self._get_or_create_nested_backlinks(item_value, item_model)
  branches[item[0]] = backlink
```

Celui-ci reconstruit un arbre de les sous-objets (envoyé en JSON) d'un arbre de les objets de les modèles de Django. Maintenant, l'application peut appeler `get_or_create` avec l'objet de base (pour ce profondeur de récursion) et retourner l'instance associé. La variation `get_or_create_external` fait le même, mais s'il reçoit un objet locale qui n'existe pas, il généra une exception (Nantes ne peut pas créer des résources Parisiens!)

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

Au milieu le code est responsable de la création de les `Follower`s nécessaires pour les resources de l'éxpediteur. Un suiveur est quel qu'un qui voudrait notifier de les changements sur les connexions de cette resource à la prochaine. Dans notre example, Paris voulait être notifiée que Bob avait rejoint un cercle de Nantes, mais si Bob supprimerait son compte Parisienne, Nante souhaite être informée aussi pour lui supprimer de son cercle.

## Le Résultat

Bob peut maintenant se contenter de savoir que par une application il peut accéder ses cercles de Paris, Nantes, Londres et New York. En utilisant la bonne application il peut aussi accéder ses postes de médias sociaux d'une service qui n'a absolument aucun rapport avec DjangoLDP, grace aux standards du web semantique.
