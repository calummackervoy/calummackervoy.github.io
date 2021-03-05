---

title: DjangoLDP 02 - ActivityQueueService
summary: Building an Asynchronous Queue for managing ActivityStreams messages in Python
lang: en
lang-ref: activity-queue-service

header_image: '/assets/img/post_headers/02.jpg'
---

[DjangoLDP](https://git.startinblox.com/djangoldp-packages/djangoldp) is a framework built on top of Django Rest Framework to provide its users with a means to create interoperable, [Linked-Data](https://www.w3.org/TR/ldp/) Django applications ready for the semantic web. In October I published a [blog post](https://calum.mackervoy.com/en/2020/10/02/backlinks.html) describing my recent work in a system for auto-detecting links to external references, sending and receiving [ActivityStreams](https://www.w3.org/TR/activitystreams-vocabulary/) messages to describe the changes and ultimately ensure consistency in a federated network.

In this blog post I will show how I built an asynchronous queue for managing the sending of activities, handling errors, recording and displaying state. The content of the messages is unimportant from the point of view of the service. We chose not to use existing libraries such as [celery](https://docs.celeryproject.org/en/stable/index.html) in order to avoid the need for a broker which would add infrastructure requirements for the use of our framework. On the flip side, we needed to keep in mind that later we will want to support the use of a broker for the efficiency benefits.

## What Kind of Concurrency to use?

The first thing to address in the design was how to manage the concurrency of the queue. There are a few options in Python, briefly:
* `multithreading`
* `asyncio`
* `multiprocessing`

A concurrency-appropriate task is either CPU-bound or it's IO-bound. In short, a CPU-bound task involves waiting for a CPU intensive task to complete (e.g. performing transformations on a large amount of data), IO-bound means waiting for user input or for a message on the network. Ours is an IO-bound task, we are sending a message to another server in the federation and waiting for a response. For this we will use `multithreading`, although `asyncio` would have been a good choice also. The main difference between the two is that the thread switching is handled between the operating system (pre-emptive multitasking), whilst in `asyncio` the threads themselves declare when they will be switched out (co-operative multitasking, because the threads must co-operate with eachother).

As a side note, in a CPU-bound task in Python you should use multi-processing, because in Python 1, 2 and 3 threads are actually running on the same processor [because of the Python GIL](https://realpython.com/python-gil/). Python threads are **concurrent**, but they are not **parallel**.

## Managing a Queue

In the previous [blog post](https://calum.mackervoy.com/en/2020/10/02/backlinks.html) of this series, we demonstrated how an individual activity should be sent adhering to the ActivityStreams and LDP specifications. Now we will consider how _many_ activities should be sent by managing them in a Queue.

Our basic requirements are:

* the `ActivityQueueService` should filter redundant activities before sending.
* it should try several times to deliver the `Activity`, recording the success or failure.
* activities should be persistent, surviving server restarts.

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

Demonstrated above the basic loop of the `ActivityQueue` is to `get` tasks, wait an amount of time specified by the third (`delay`) parameter (which hands the processor back to the `Main` thread), complete the processing of the activity and then mark the task as done, ready to process the next one. If there are no activities on the queue, `get` will block the thread until there is one available.

## Resending Failed Activities

The Python `requests` library has excellent features regarding request resending, but we wanted to have control of this process ourselves in order to ensure that the `status_code` of a failed activity, its error message and such was consistent.

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

The code here is fairly self-explanatory, although I will note that the `backoff` variable is calculated using the exponential backoff strategy, which is a tried and tested algorithm for waiting time before retrying a message, driven by an ultimately server-configured `backoff_factor`.

## Ensuring Message Persistence

In the `start` method code, we included a call to `cls.revive_activities()` at the very end of the initialisation process.

Updating from the original blog post code on the subject, we have replaced the functions for _sending_ activities with functions which instead _schedule_ activities, which the queue worker will process and ultimately decide to send. To support this, we store pending activities using a `ScheduledActivity` model, indicating that they have not yet resolved into a state of success or failure.

The code in `revive_activities` simply fetches any `ScheduledActivity` items on the database and reschedules them. If they are here then either they have been put there by a sysadmin, or they were scheduled on the queue before a server restart prevented them from completing.

## Being Notified about Failure: Sentry.io

Storing failed activities is great, but in the context of the federation a failed activity is an inconsistency in the collective data store, which may impact user experience. A perfect system would accommodate for retrying ancient activities for any server on a whitelist, or better still would utilise a _pull_ system where the previously-down server can notify its peers that it's back and ready to clean their previously failed activities.

For now this could involve human intervention, with the help of [Sentry.io](https://sentry.io/welcome/), a service dedicated to notifying developers and sysadmins of errors which have occured on any connected servers. Using this service, the call to `logger.error` will flag the event to the Sentry server, which will notify the admins who can then use extensive information stored about the activity to investigate the issue.

## Next

This just about covers it for the second iteration of DjangoLDP's `ActivityStreams` system. In our next iteration we plan some new improvements, primarily for efficiency:
<ul>
<li>the optional backing of a broker such as Celery/Redis where the client prefers</li>
<li>the replacement of `ScheduledActivity` with a filesystem-backed alternative, to avoid database access</li>
<li>replacing the use of `requests` with an asynchronous variant</li>
<li>we're considering building a `multiprocessing` solution</li>
</ul>