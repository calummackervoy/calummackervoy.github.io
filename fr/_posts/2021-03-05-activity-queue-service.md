---

title: DjangoLDP 02 - ActivityQueueService
summary: Création d'Une Queue Asynchrone pour la Gestion des Messages ActivityStreams en Python 
lang: fr
lang-ref: activity-queue-service

header_image: '/assets/img/post_headers/02.jpg'
---

[DjangoLDP](https://git.startinblox.com/djangoldp-packages/djangoldp) est un framework qui repose sur Django Rest Framework et permet à notre utilisateurs de créer des applications Django interiopérables, avec les standards de [Linked-Data Protocol](https://www.w3.org/TR/ldp/) (LDP). En octobre, j'ai écris un [article de blog](https://calum.mackervoy.com/fr/2020/10/02/backlinks.html) sur mon travail récent dans une système qui détecte automatiquement les liens aux ressources externes, et qui envoi et récevois des messages [ActivityStreams](https://www.w3.org/TR/activitystreams-vocabulary/) afin d'assurer la cohérence dans un réseau fédéré.

Je vais vous démontrer comment j'ai construis un queue asyncrhone pour la gestion des messages, réagit aux erreurs, enregistrement et affichage de l'état. Ce n'est pas importante quoi est le contenu de les messages, à le point de vue de la service. On a choisit de n'utiliser pas les libraries existant comme [celery](https://docs.celeryproject.org/en/stable/index.html) afin d'éviter la besoin d'avoir l'infrastructure additionel pour l'utilisation de notre framework. À l'autre côté, nous devions prendre en compte dans notre conception que nous voudrons soutenir l'utilisation d'une service comme Redis plus tard pour les avantages en termes de performances.

## Quelle type de concordance utilisons-nous ?

La première question pour le conception est comment faire le concordance de le queue. Il y a trois choix en Python, bréfement ils sont:
* `multithreading`
* `asyncio`
* `multiprocessing`

La tâche sera soit lié au CPU ou lié au E/S. En brèf ça veut dire qu'une tâche doit attendre les activités du CPU (p. ex. s'il y a beaucoup des transformations aux données) ou de l'entrée de l'utilisateur ou pour une réponse sur le réseau. Le nôtre est une tâche lié au E/S, parce qu'on a envoyé une message vers un autre serveur et nous attendons son réponse. En fin on va utiliser `multithreading`, mais `asyncio` soit également un bon choix. La principale différence entre les deux est que le changement de thread est géré par le système d'exploitation (multitâche préemptif), alors que dans `asyncio` les threads eux-mêmes déclarent quand ils seront changés (mutlitâche coopératif).

À titre d'information, quand la tâche est lié au CPU en Python on devrait utiliser `multiprocessing`, parce qu'en Python 1, 2 et 3 les threads sont en fait exécutés sur le même processeur [à cause de la GIL] (https://realpython.com/python-gil/). Threads en Python sont **concurrents**, mais ils ne sont pas **parallèles**.

## La gestion de la Queue

Dans [l'article précédent](https://calum.mackervoy.com/fr/2020/10/02/backlinks.html), nous avons démontré comment une activité individuelle peut-être envoyée en respectant les spécifications ActivityStreams et LDP. Maintentant, nous examinons combien d'activités doivent être envoyées par sa gestion dans une Queue.

Nos exigences sont :

* la `ActivityQueueService` doit filtrer les activités redondantes avant de les envoyer.
* il doit essayer de les livrer plusieurs fois, en enregistrant le succès ou l'échec.
* les activités doit survivre aux redémarrages du serveur.

```python
class ActivityQueueService:
    '''Manages an asynchronous queue for Activity format messages'''
    initialized = False
    queue = None

    @classmethod
    def start(cls):
        def queue_worker(queue):
            while True:
                # wait for queue item to manifest
                item = queue.get()
                time.sleep(item[2])
                # activity queue worker filters redundant activities before sending
                cls._activity_queue_worker(item[0], item[1])
                cls.queue.task_done()

        # this is the Singleton design pattern - one and only one Queue will be running at once
        if not cls.initialized:
            cls.initialized = True

            # initialise the queue worker - infinite maxsize
            cls.queue = Queue(maxsize=0)
            t = threading.Thread(target=queue_worker, args=[cls.queue])
            # running as a Daemon means that the thread will live and die with the Main thread
            t.setDaemon(True)
            t.start()

            cls.revive_activities()
```

Le fonctionnement de base de l'`ActivityQueue` consiste à rétrouver (`get`) les tâches, attends un delai configuré (qui rend le processeur au thread `Main`), et, une fois le traitement de la tâche terminé, la marquer comme terminée. S'il n y a plus des activités en Queue, `get` va bloquer le thread jusqu'à un est disponible.

## Renvoi des activités échouées

La librarie `requests` de Python possède d'excellentes fonctionnalités concernant le renvoi des requêtes, mais nous voulions avoir le contrôle de ce processus nous-mêmes afin de nous assurer que le `status_code` d'une activité échouée, son message d'erreur et autres soient cohérents.

```python
@classmethod
    def _attempt_failed_reschedule(cls, url, scheduled_activity, backoff_factor):
        '''
        either re-schedules a failed activity or saves its failure state, depending on the number of fails and the
        fail policy (MAX_ACTIVITY_RESCHEDULES)
        :return: True if it was able to reschedule
        '''
        if scheduled_activity.failed_attempts < MAX_ACTIVITY_RESCHEDULES:
            backoff = backoff_factor * (2 ** (scheduled_activity.failed_attempts - 1))
            cls.resend_activity(url, scheduled_activity, backoff)
            return True

        # no retries left, save the failure state
        logger.error('Failed to deliver backlink to ' + str(url) + ' after retrying ' +
                     str(MAX_ACTIVITY_RESCHEDULES) + ' times')

        cls._save_sent_activity(scheduled_activity.to_activitystream(), ActivityModel, success=False,    external_id=url, type=scheduled_activity.type, response_code='408')
        return False
```

Je note que la variable `backoff` est calculée en utilisant la stratégie de backoff exponentielle, piloté par le paramètre `backoff_factor` configuré par le serveur.

## Persistence des messages

Dans le méthode `start`, nous avons inclus un appel à `cls.revive_activitie()` à la toute fin du processus d'installation.

Le code de l'article original a marché en _envoyant_ les activités, mais désormais il marche en _programmant_ les activités, en utilisant un nouveau modèle, `ScheduledActivity`, une sous-classe de `Activity` ce qui signifie que qu'il ne s'est pas encore résolu au état de succès ou d'échec.

Le code dans `revive_activites` simplement récupère des objets du `ScheduledActivity` et les reprogramme. S'ils ont été mis là par un administrateur ou s'ils ont été ajouter là avant un rédemmarage du serveur.

## Sentry.io

Stocker les activités echouée, ce n'est pas mal, mais dans le cadre de la fédération, une seule activité échouée est une incohérence dans le réseau, ce qui peut avoir un impact sur l'expérience utilisateur. Un système idéel utiliserait un sytème d'extraction, où le serveur précédemment en panne pourrait notifier à ses pairs qu'il est de retour, il va nettoyer ses données, ou au moins permettrait de réessayer d'anciennes activités pour n'importe quel serveur sur une liste blanche. Lorsque le serveur est en panne pendant une longue période, la problème devient pas mal difficile.

Pour l'instant on utilise une intervention humaine, avec l'aide de [Sentry.io](https://sentry.io/welcome/) (site anglaise), un service dédié à la notification aux administrateurs système des erreurs qui se sont produites sur les serveurs connectés. Grace à ce service, un appel à `logger.error` signalera l'événement au serveur Sentry, qui en informera les administrateurs qui pourront alors utiliser les nombreuses informations stockées sur l'activité afin de la corriger.

## Suivant

Pour l'instant c'est tous sur le seconde itération du système `ActivityStreams` de DjangoLDP. À la suivante nous discutons des nouvelles améliorations, principalement pour l'efficacité :

<ul>
<li>Le support optionnel d'un broker comme Celery/Redis</li>
<li>Le remplacement du `ScheduledActivity` avec un alternatif fourni par le système de fichiers</li>
<li>le remplacement de la librarie `requests` avec une variante asynchrone</li>
</ul>