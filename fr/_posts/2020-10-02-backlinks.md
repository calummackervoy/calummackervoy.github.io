---

title: La Construction d'un Framework pour les Reseaux Fédérés
summary: En Utilisant des Bases de Données Relationelles, Django et ActivityStreams
lang: fr
lang-ref: backlinks

header_image: '/assets/img/post_headers/sky.jpg'
---

Novembre 2019 j'ai commencé à travailler sur [DjangoLDP](https://git.startinblox.com/djangoldp-packages/djangoldp). C'est un framework qui repose sur Django Rest Framework et permet à notre utilisateurs de créer des applications Django interiopérables, avec les standards de [Linked-Data Protocol](https://www.w3.org/TR/ldp/) (LDP). Du coup, le fédération est la connexion des serveurs qui utilisent les stacks différents avec une protocole standard, afin que le service soit le même pour tous. On peut construire un web **décentralisé**, en revendiquant le pouvoir des monopoles et en le restituant aux utilisateurs.

Pour la publication de la version 0.7, nous travaillons sur un système permettant aux instances de tenir leurs pairs au courant, pour apporter du cohérence dans un réseau fédéré.

Imaginez que nous avons un réseau constitué de deux serveurs, "Paris", et "Nantes":

<img src="{{ '/assets/img/post_assets/backlinks/1.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">chiffre 1: Paris et Nantes</p>

Les deux fournissent une application [Startin'Blox](https://startinblox.com/fr/), qui est un framework front-end pour servir les ressources fédérées à l'utilisateur. Par exemple, si nous avons les modèles suivant:

```python
from django.conf import settings
from djangoldp.models import Model

class Circle(Model):
    # ...

class CircleMember(Model):
    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="circles")
    
```

Il y a un utilisateur, Bob, qui a un compte avec Paris. Il est membre de plusieurs Cercles sur Paris avec ses amis. Il vient de trouver un Cercle super cool sur Nantes, et il veut le rejoindre

<img src="{{ '/assets/img/post_assets/backlinks/2.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">chiffre 2: Bob rejoind un cercle de Nantes</p>

Nantes peut authentifier le jeton Parisien de Bob en utilisant le fournisseur [OIDC](https://auth0.com/docs/protocols/oidc), et il ajoute Bob comme il l'a demandé. Mais son compte, stocké à Paris, n'a aucune idée qu'il est membre de ce cercle! Quand Startin'Blox envoie une demande à https://paris.startinblox.com/users/bob/circles/, le nouveau cercle de Nantes ne sera pas enregistré ici! Donc il faut que Nantes fasse savoir cet evenement à Paris.

Nous trouverons une solution qui utilise le DjangoLDP `Model`, afin que le même code marche avec tous les modèles connectés.

## Étape 1: La Demande

Nantes est capable de détecter qu'il a besoin de notifier quelque chose à Paris, parce qu'un utilisateur avec un `urlid` Parisien (https://paris.startinblox.com/users/bob/) a été connecté à une ressource locale.

<img src="{{ '/assets/img/post_assets/backlinks/3.png' | absolute_url }}" class="blog-full-image"/>
<p class="image-caption">chiffre 3: Nantes a envoyé Paris un activité</p>

Pour le contenu de la notification, on utilise le format de [ActivityStreams](https://www.w3.org/TR/activitystreams-vocabulary/), qui fournit un langage commun pour décrire les actions entre différents objets. On utilise aussi une ontologie du [Resource Description Framework (RDF)](https://www.w3.org/RDF/), pour partager les données sémantiques avec nos pairs. Par exemple, encoder dans `"@type": "hd:circle"` est une référence d'un document RDF (que nous référençons dans le champ `@context`) pour décrire les propriétés qui composent un cercle. De cette façon, nous pouvons utiliser le RDF pour relier entre elles des applications qui peuvent stocker des cercles de différentes façons, mais qui s'accordent au moins sur ce qu'est un "cercle". Le destinataire pourrait même ne pas utiliser du tout DjangoLDP !

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
(Une Activity en format [JSON-LD](https://json-ld.org))

La requête est ici générée avec une fonction build_object_tree, qui construit le type et l'identifiant de l'objet de base, avant de faire de même pour chaque objet lié (à une profondeur de un). Notre récepteur peut cependant gérer des arbres avec une plus grande profondeur, grâce à une fonction récursive que nous aborderons plus tard. Selon la norme ActivityStreams, nous aurions également pu envoyer l'objet sérialisé avec juste un urlid, "object" : "https://nantes.startinblox.com/circle-members/1/", et le serveur de Paris pourrait déduire ses relations en effectuant une requête GET sur la ressource

## Étape 2: Le Récepteur

Le `inbox` de Bob, fourni par le `InboxView` du serveur Parisien, a maintenant reçu l'Activity de Nantes. L'analyse d'une Activity se déroule comme ci-dessous :

1. validez l'Activity
2. analysez l'Activity, en faisant les changements nécessaire
3. répondez 201, avec l'Activity enregistrée dans le header `Location` de la réponse

### Validez l'Activity

la validation de l'Activity se fait en 3 parties :

* _authentification_ (valider que le serveur est celui qu'il prétend être)
* _authorisation_ (Toulouse n'est pas capable de créer un cercle nantais)
* valider les champs nécessaires et le contenu

### Analysez l'Activity

La partie la plus amusante est l'analyse de l'Activity. En DjangoLDP le `InboxView` se compose de fonctions pour recevoir des différents types d'Activity. Mais dans le code, la star de la série est une fonction récursive get_or_create_nested_backlinks, qui, étant donné un arbre d'objets imbriqués, va résoudre récursivement chaque nœud, en obtenant un backlink existant si possible, ou en en créant un. Elle est enveloppée dans une opération atomique de sorte que tout soit terminé avec succès, ou rien, en cas d'erreur.

```python
for item in obj.items():
  ...
  item_model = Model.get_subclass_with_rdf_type(item_value['@type'])
  ...

  # push nested object as a branch
  backlink = self._get_or_create_nested_backlinks(item_value, item_model)
  branches[item[0]] = backlink
```

Il s'agit essentiellement de reconstituer l'arbre des sous-objets (envoyés en JSON) en un arbre d'objets Django que nous savons traiter. Maintenant, l'application peut appeler `get_or_create` avec l'objet de base (pour cette profondeur de récursion) et retourner l'instance associé. La variation `get_or_create_external` fait de même, mais s'elle reçoit un objet local qui n'existe pas, elle génère une exception (Nantes ne peut pas créer des ressources Parisiennes!)

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

La partie centrale du code gère ici la création de Followers pour les ressources de l'expéditeur. Un suiveur est une boîte de réception qui s'abonne à la ressource et qui souhaite être informé des modifications futures de ses connexions. Dans notre exemple, Paris voulait être notifiée que Bob avait rejoint un cercle de Nantes, mais si Bob supprime son compte Parisien, Nantes devra également être informée qu'il doit être retiré de leur cercle.

## Le Résultat

Bob peut maintenant se contenter de savoir que par une application il peut accéder aux cercles de Paris, Nantes, Londres et New York. En utilisant la bonne application frontale, il a également pu accéder à ses posts sur les médias sociaux à partir d'un service totalement indépendant. Tout cela grâce à la puissance des standards du web sémantique comme Linked Data Protocol et ActivityStreams.

J'ai décrit dans ce journal de développement comment fonctionne la fédération dans la version 0.7 de DjangoLDP. Au moment de la publication, elle est un peu dépassée et nous avons quelques nouveaux systèmes de pointe :-)

Dans un prochain billet, je présenterai un nouveau ActivityQueueService, une file d'attente d'activité asynchrone que nous utilisons pour protéger la fédération des incohérences (par exemple, que se passe-t-il si Paris est hors ligne lorsque Bob rejoint un cercle à Nantes ?)
