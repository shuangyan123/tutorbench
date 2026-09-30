import { escapeHtml as e, type SitePage } from "../html.js";
import { siteIcon as icon } from "../icons.js";
import { renderEditorialBotanical } from "../illustrations.js";

const BLOG_PUBLISHED_DATE = "September 17, 2026";
const CLASSROOM_INTERFACE_PUBLISHED_DATE = "September 28, 2026";
const LEARNING_FAILURE_PUBLISHED_DATE = "September 30, 2026";

export interface BlogPostSummary {
  readonly category: "Perspective";
  readonly publishedDate: string;
  readonly title: string;
  readonly description: string;
  readonly excerpt: string;
  readonly route: string;
  readonly image: string;
  readonly imageAlt: string;
}

export interface BlogCallout {
  readonly label: string;
  readonly title?: string;
  readonly body: string;
}

export interface BlogArticleSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly progression?: readonly { readonly label: string; readonly text: string }[];
  readonly callout?: BlogCallout;
}

export interface BlogArticle extends BlogPostSummary {
  readonly sections: readonly BlogArticleSection[];
  readonly pullQuote: string;
  readonly evidenceBoundary: string;
}



const LEARNING_FAILURE_SECTIONS: readonly BlogArticleSection[] = [
  {
    heading: "A classroom has to choose a starting point",
    paragraphs: [
      "A teacher can explain a new topic, sketch a framework on the board, demonstrate a formula, assign exercises, review the answers, and assign more exercises. None of those actions is inherently poor teaching. Direct explanation, worked examples, practice, and feedback all matter.",
      "The constraint is that a classroom has to perform them for many learners at once. A lesson needs one starting point, one approximate pace, and one sequence even though students do not actually arrive at the same point.",
      "One learner may understand every prerequisite. Another may be missing one concept. Another may have stopped understanding two chapters earlier. The class still moves forward, and a small gap can gradually become the learner's entire experience of the subject.",
    ],
  },
  {
    heading: "Asking for help has a social cost",
    paragraphs: [
      "In theory, a learner who does not understand can ask the teacher. In practice, asking is not free. Raising a hand can mean publicly admitting that everyone else seems to understand something that you do not. Approaching a teacher after class requires crossing a social boundary.",
      "A learner may worry that the question is too basic, that the teacher is busy, that the explanation will start too far ahead again, or that asking for the fourth time will be embarrassing. Sometimes the learner cannot even describe what is missing.",
      "A teacher responsible for an entire classroom may not have the time to reconstruct one student's knowledge from the beginning. That is not necessarily a failure of care. It is also a capacity constraint. So the learner stays quiet, and the lesson continues.",
    ],
  },
  {
    heading: "Repeated failure eventually changes the meaning of learning",
    paragraphs: [
      "At first, the problem may be academic: I do not understand this. After enough repetition, it can become personal: I am bad at this. Then broader: I am bad at learning.",
      "A student who repeatedly listens without understanding, attempts problems without success, receives poor grades, or is mocked for falling behind is not experiencing learning as progress. Learning becomes associated with confusion, exposure, boredom, and failure.",
      "From the outside, the eventual response may look like indifference. But disengagement can also be a protective response to repeated experiences in which effort does not appear to change the outcome. Saying I never cared anyway can be easier than saying I cared, tried, and still failed.",
    ],
    progression: [
      { label: "Confusion", text: "a concept or prerequisite is not understood." },
      { label: "Silence", text: "asking for help feels socially expensive or difficult to formulate." },
      { label: "Accumulation", text: "new material is built on top of unresolved gaps." },
      { label: "Failure", text: "practice increasingly produces evidence of being behind rather than evidence of progress." },
      { label: "Withdrawal", text: "avoiding the task becomes easier than repeatedly testing a painful prediction." },
    ],
  },
  {
    heading: "Distant consequences are weak rewards",
    paragraphs: [
      "Education often responds with long-range incentives: study now to enter a better school, earn stronger qualifications, and find a better job. Those consequences can matter, but they are distant and abstract.",
      "The learner's immediate experience is much closer: I am sitting here now. I do not understand this problem now. Everyone else seems ahead of me now. I am going to fail the next exercise now.",
      "When learning itself produces almost no positive feedback, increasingly severe descriptions of the future may stop working. The learner needs evidence in the present that effort can produce change.",
    ],
  },
  {
    heading: "The strongest reward may be visible progress",
    paragraphs: [
      "Positive reinforcement in education does not have to mean badges, points, streaks, praise animations, or gamification. A more powerful reward can be simpler: I can do something now that I could not do twenty minutes ago.",
      "Suppose a learner is failing quadratic-function problems. Instead of repeating the whole chapter, a tutor discovers that the real gap is an earlier understanding of how parameters change a graph. The tutor goes back, rebuilds that prerequisite, tries a near variation, asks the learner to explain it, and then returns to the original problem.",
      "Something that previously looked impossible now has a path through it. The important change is not one correct answer. It is the learner's prediction about difficulty: I do not understand no longer has to mean I probably never will.",
    ],
    callout: {
      label: "Learning signal",
      title: "Progress should be perceptible to the learner.",
      body: "A system can make small gains visible without pretending every attempt deserves praise. The useful signal is evidence that effort, diagnosis, and the right amount of support changed what the learner can do.",
    },
  },
  {
    heading: "“I do not understand” should be a valid input",
    paragraphs: [
      "This may be where AI tutoring has an unusually important advantage. A learner should be able to say: I have no idea. You started too far ahead. I do not understand what that symbol means. You already explained it three times and I still do not get it.",
      "The system should not become impatient, interpret repeated questions as disrespect, or require the learner to perform confidence before receiving help. Instead, it can move backwards until it finds a stable starting point.",
      "Personalization is therefore deeper than changing a mathematics problem so that it mentions a student's favourite sport. The important question is: where is this learner's actual starting point?",
    ],
    progression: [
      { label: "Current problem", text: "locate the step where progress stopped." },
      { label: "Prerequisite", text: "test the concept or skill that step depends on." },
      { label: "Starting point", text: "move backward until the learner can work reliably." },
      { label: "Rebuild", text: "advance again with small checks and fading support." },
      { label: "Transfer", text: "verify that the learner can use the idea without the same scaffold." },
    ],
  },
  {
    heading: "A Tutor also shapes the emotional experience of learning",
    paragraphs: [
      "An educational AI that only knows how to provide explanations is incomplete. Sometimes the correct next action is not another explanation. A learner may arrive frustrated, ashamed, angry, anxious about an exam, or convinced that further effort is pointless.",
      "Patience is instructional. Allowing mistakes is instructional. Reducing shame around not knowing is instructional. Helping someone turn I am stupid into we found the specific thing that is missing is instructional.",
      "That does not mean an AI tutor should pretend to be a therapist. Ordinary learning frustration and emotional support are different from serious mental-health crises, abuse, severe bullying, or risk of self-harm. Those situations require clear safeguarding boundaries and appropriate human support. AI can be a low-friction first point of contact without becoming a closed final point of contact.",
    ],
  },
  {
    heading: "AI education may enter through the space outside school",
    paragraphs: [
      "AI education may not enter the classroom first. A classroom is an institutional environment, so introducing an AI Tutor immediately raises questions about teacher roles, school policy, devices, privacy, assessment, safety, classroom management, and responsibility.",
      "Outside the classroom, the first proposition can be much simpler: here is somewhere you can ask the questions you were afraid to ask. Students can use it after school, families can observe whether it helps, and learners can become familiar with individualized tutoring before a school has to redesign the classroom around it.",
      "A plausible adoption path is private learning support, then structured after-school tutoring, then teacher-visible support, then supervised school use, and only later deeper classroom integration. Acceptance can grow from repeated useful experience rather than from claims about transforming education.",
    ],
  },
  {
    heading: "The goal is not dependence on the Tutor",
    paragraphs: [
      "There is an obvious danger. A system that always makes the learner feel better by doing difficult work for them can produce pleasant interactions without producing learning.",
      "Support therefore has to preserve agency. The Tutor should help the learner re-enter the task, not permanently remove the task. The important progression is: I cannot do this; I can do this with help; I can do this with less help; I can do this alone; I can use it somewhere new.",
      "The success condition is not that the student enjoys talking to the AI. It is that the student increasingly needs the AI less for things they have already learned.",
    ],
  },
  {
    heading: "Education should make progress perceptible",
    paragraphs: [
      "A scalable AI Tutor could eventually diagnose misconceptions, select exercises, adapt explanations, monitor practice, preserve evidence of mastery, and coordinate with teachers. But one of its earliest contributions may be simpler.",
      "It can create a learning environment in which ignorance is not embarrassing, help is consistently available, starting points can differ, and progress is small enough to be noticed.",
      "For a learner who has spent years experiencing education mainly as evidence of failure, that may be where learning begins again.",
    ],
  },
];

const CLASSROOM_INTERFACE_SECTIONS: readonly BlogArticleSection[] = [
  {
    heading: "One robot still scales like one teacher",
    paragraphs: [
      "Embodied AI makes it tempting to imagine the future classroom as a room with a robotic teacher at the front. But replacing a human teacher with one machine does not solve the underlying capacity problem. Thirty learners would still be sharing one public channel of attention.",
      "If AI is going to make one-to-one teaching genuinely scalable, the important change is not that the teacher acquires a body. It is that every learner gains a private instructional channel while the classroom remains a shared social space.",
    ],
    callout: {
      label: "Design question",
      title: "Do not replicate the teacher. Redesign the learning interface.",
      body: "The useful unit may be a private Tutor channel at every desk, not a single embodied system at the front of the room.",
    },
  },
  {
    heading: "Voice matters, but classrooms are shared acoustic spaces",
    paragraphs: [
      "Speech is an unusually efficient interface for tutoring. A learner can ask why a step is wrong, describe uncertainty, or answer a question much faster than by typing. Voice also preserves some of the immediacy of real tutoring.",
      "But a classroom with thirty continuous voice conversations would be difficult to concentrate in. The practical answer is probably not voice-only tutoring. Writing and visual work should remain the default channel, with short, low-volume voice exchanges used when speech has a clear advantage.",
      "A near-mouth microphone, push-to-talk interaction, and private audio output could make voice useful without turning every desk into an always-on call.",
    ],
  },
  {
    heading: "The learning surface should feel more like paper than a tablet",
    paragraphs: [
      "Many classroom tasks are not conversations. Students solve equations, sketch diagrams, annotate text, derive formulas, and work through practice sets. For those activities, handwriting is part of the thinking process.",
      "A conventional screen can add friction through scrolling, zooming, small writing areas, glass-like pen feel, notifications, and application switching. A learning device should therefore be optimized for writing first: a large low-distraction surface, a passive stylus, minimal interface chrome, and as little reason as possible to think about the operating system.",
      "The goal is not to make students feel that they are using a computer. The goal is to let them feel that they are doing exercises while the system quietly preserves the structure of the work.",
    ],
  },
  {
    heading: "Record events instead of asking AI to guess them",
    paragraphs: [
      "The most important architectural choice is to separate facts that the system can know directly from interpretations that require inference. A digital ink engine can know when the pen touched the surface, where it moved, how long a stroke lasted, which tool was active, and which strokes were later erased or undone.",
      "Page and question identity should also be structural whenever possible. If the worksheet is already digital, each question can own a known region and identifier. The Tutor should not need a vision model to rediscover information the document system already possesses.",
      "Likewise, the problem statement itself should be structured data. OCR and visual parsing are useful when importing legacy worksheets, but they should not be the permanent representation of a task once the material has entered the learning system.",
    ],
    progression: [
      { label: "Ink events", text: "strokes, coordinates, timestamps, pressure, erase, undo, and redo." },
      { label: "Document structure", text: "worksheet, page, question, learning objective, and response region." },
      { label: "Semantic interpretation", text: "recognized expressions, diagrams, written language, and reasoning steps." },
      { label: "Learning interpretation", text: "progress, repeated error, possible misconception, need for support, and mastery evidence." },
    ],
  },
  {
    heading: "A pause is an observation, not a diagnosis",
    paragraphs: [
      "Rich interaction data creates a new risk: over-interpreting behavior. Thirty seconds without a pen event is a fact. It does not automatically mean that the learner is stuck. The learner may be reading, checking, calculating mentally, or simply thinking.",
      "The same distinction applies to erasing. What matters pedagogically is not that an eraser crossed the screen seven times, but that the learner replaced one mathematical claim with another. Raw events should be preserved, while higher-level interpretations remain revisable.",
      "A stronger stuck signal might combine a long pause, repeated rewriting of the same expression, the same error appearing again, lack of forward progress, and an explicit help request. The system should be able to say what it observed separately from what it inferred.",
    ],
  },
  {
    heading: "Attempts need an explicit contract",
    paragraphs: [
      "Attempt count sounds objective until a learner edits the same solution repeatedly. One changed digit is not necessarily a new attempt, and a large rewrite may or may not represent a restart.",
      "The cleanest first implementation may include a tiny explicit action such as Check or Submit. When the learner commits a solution, the system gets an auditable attempt boundary. More sophisticated segmentation can later infer candidate boundaries from major rewrites, but the raw event history should remain the source record.",
      "This matters because two learners can end on the same correct answer while producing very different evidence. One may solve independently in thirty seconds. Another may erase two incorrect answers, request a hint, pause for a minute, and then succeed. Final-answer grading treats them as identical; a learning system should not.",
    ],
  },
  {
    heading: "Practice can become the input to the next lesson",
    paragraphs: [
      "Once classroom work is structured as a sequence of questions, attempts, revisions, hints, and outcomes, practice stops being only something to grade. It becomes evidence for planning what the learner should see next.",
      "A score such as 12 out of 15 says relatively little about why three items failed. A richer record can distinguish a stable misconception from a one-off arithmetic slip, a standard form that the learner can solve from a transfer form that still breaks, or a skill that works only after prompting.",
      "The next learning set can then be chosen from the actual evidence: a diagnostic example, a targeted representation, a near-transfer problem, an independent problem, and later a retrieval check. Today's exercise becomes part of tomorrow's curriculum.",
    ],
  },
  {
    heading: "Let homework be learning and move verification into class",
    paragraphs: [
      "Generative AI makes unsupervised homework a weaker source of evidence about independent mastery. Trying to prove that every piece of work completed at home was unaided may become increasingly unrealistic.",
      "A more robust design is to separate learning from verification. Outside class, students may use AI, reference material, explanations, and extra practice freely. In class, short supervised checks can establish what the learner can do when those supports are removed.",
    ],
    callout: {
      label: "Classroom loop",
      title: "Check → learn → transfer → update.",
      body: "A short independent check can establish the starting point; adaptive tutoring can respond to the evidence; a second independent transfer task can test whether the learning survives when the Tutor is removed.",
    },
  },
  {
    heading: "Assessment can become a daily loop instead of a distant event",
    paragraphs: [
      "Supervised verification does not require turning every lesson into a traditional exam. A lesson can begin with a short independent check, move into Tutor-supported learning, and end with a new independent transfer problem.",
      "That structure creates a compact before-intervention-after sequence inside the normal school day. The important evidence is no longer that the student had a successful conversation with an AI. It is that the student can subsequently perform without the AI.",
      "A school-managed device can make these boundaries explicit by switching between Learn, Practice, and Check modes. The student should not be responsible for deciding when outside assistance is allowed.",
    ],
  },
  {
    heading: "Teachers become orchestrators of parallel tutoring",
    paragraphs: [
      "None of this requires removing the teacher from the classroom. It changes where scarce human attention is spent. Instead of repeating the same explanation thirty times, the teacher can see where individual Tutors are succeeding, where learners remain stuck, and where a pattern has become a class-wide problem.",
      "If eight students show the same misconception, the best intervention may be to pause the individualized flow and teach that idea to the room. AI provides parallel attention; the teacher decides when parallelism should stop.",
      "The classroom therefore becomes a coordinated system: individual Tutor channels for continuous support, supervised evidence for trustworthy learner state, and human intervention for judgment, shared explanation, safety, motivation, and social coordination.",
    ],
  },
  {
    heading: "The product may be a digital exercise book, not another tablet",
    paragraphs: [
      "Putting these requirements together suggests a different hardware category: a school-managed digital exercise book or instrumented learning surface. It would prioritize a paper-like writing experience, structured worksheets, persistent ink history, short private voice exchanges, and explicit Tutor-enabled and Tutor-disabled modes.",
      "It would not need an app store, social notifications, or an unrestricted browser. The most successful version might be a computer that deliberately hides the fact that it is a computer.",
      "Underneath that simple surface, however, the system could preserve a chain from stroke to revision to attempt to evidence to intervention to independent verification. That chain is more interesting than the device itself because it connects tutoring decisions to observable learner progress.",
    ],
  },
  {
    heading: "The larger question is not how to put AI into school",
    paragraphs: [
      "If we preserve the old interface, old homework model, and old evidence model, a powerful AI Tutor can still collapse into a convenient answer machine. The deeper opportunity is to redesign the learning environment around individualized instruction and trustworthy evidence.",
      "That means asking different questions: What should the Tutor do now? How much help is appropriate? When should it stop helping? What changed in the learner's work? Can the learner still perform when the Tutor is removed?",
      "The future classroom may not need thirty robots. It may need thirty private learning channels, one coordinated classroom, and a much better account of what it means to have actually learned.",
    ],
  },
];

const WHY_TEACHING_SECTIONS: readonly BlogArticleSection[] = [
  {
    heading: "The scarce resource is attention",
    paragraphs: [
      "One teacher can explain an idea to a room, but cannot continuously observe every learner, diagnose every misconception, choose a different explanation for each student, verify genuine understanding, and adjust the next task for everyone at once. That is a capacity constraint even when the teacher is excellent and conscientious.",
      "K12 systems therefore work at the level of groups. They need classrooms to remain orderly, curricula to move forward, exams to be administered, and students to cross common thresholds. Individual optimization is desirable, but it competes with the practical requirement to teach many people at the same time.",
    ],
  },
  {
    heading: "Scores create a powerful external structure",
    paragraphs: [
      "Much K12 learning is not purely voluntary. Families and schools use grades, exams, schedules, expectations, and supervision to make learning happen even when a student is not intrinsically interested in the subject. Students who perform well often receive more recognition and confidence; students who repeatedly fall behind can experience the opposite.",
      "This means an education system is doing at least two jobs at once: teaching, and creating an environment in which learning is difficult to avoid. Any serious AI education system has to understand both jobs.",
    ],
  },
  {
    heading: "Private tutoring reveals what families are really buying",
    paragraphs: [
      "A private tutor is valuable not only because the tutor may explain a subject well. The product also includes dedicated attention, direct accountability to the family, supervision of the student, visible progress, and a trust signal built from credentials, experience, reputation, or past results.",
      "The expensive part is that all of this is tied to a person's time. High-quality one-to-one attention is difficult to distribute broadly because each additional learner requires another block of human labor.",
    ],
  },
  {
    heading: "AI changes the cost structure only if it can actually teach",
    paragraphs: [
      "If an AI system can reliably diagnose a learner, select an appropriate explanation, generate practice, detect false mastery, revisit weak knowledge, adapt over time, and verify learning rather than merely produce answers, then individualized teaching attention becomes much more reproducible.",
    ],
    callout: {
      label: "Working hypothesis",
      title: "Teaching could become computationally scalable.",
      body: "Instead of many students sharing one teacher's limited instructional attention, each student could have a persistent teaching system while human attention is reserved for the tasks that still require human presence and responsibility.",
    },
  },
  {
    heading: "The standard cannot be “the student got the answer”",
    paragraphs: [
      "An AI can make a learner look more capable by doing cognitive work on the learner's behalf. That is not the same as learning. The stronger test is whether the student can retain, transfer, and apply the knowledge after the AI is removed.",
      "For that reason, AI education should not be trusted because a model sounds intelligent or because it solves benchmark questions. It should be trusted only to the extent that we can show that its teaching changes the learner in durable and useful ways.",
    ],
  },
  {
    heading: "Why Teachometry exists",
    paragraphs: [
      "The long-run question is not simply whether an AI can answer correctly. It is whether an AI can take responsibility for progressively larger parts of teaching. That requires measurement at several levels: observable tutoring behavior, actual learning effectiveness, and eventually instructional autonomy over longer periods.",
      "Teachometry exists to turn those claims into testable questions. The goal is not to assume that AI has already replaced the teacher. The goal is to build the evidence needed to know what it can reliably do, for whom, under what conditions, and where human teaching remains necessary.",
    ],
  },
];

const TEACHING_AND_SUPERVISION_SECTIONS: readonly BlogArticleSection[] = [
  {
    heading: "Today's teacher is several jobs in one",
    paragraphs: [
      "A classroom teacher explains content, diagnoses mistakes, prepares exercises, grades work, answers questions, motivates students, manages behavior, communicates with families, and remains responsible for a room full of minors. These functions are packaged together because historically the same adult had to be present to perform the teaching.",
      "That packaging should not be mistaken for a law of nature. If instruction can be delivered reliably by another system, the human functions that remain can be designed separately.",
    ],
  },
  {
    heading: "AI has no inherent authority",
    paragraphs: [
      "A student can ignore an AI tutor, close the page, ask it for the answer, or simply stop working. That makes supervision a first-class design problem. Pretending that an AI persona is a strict teacher does not create real authority.",
      "A more realistic model is that families or schools provide the legitimate rules, while software executes them transparently: scheduled study periods, required tasks, mastery checks, progress records, escalation when work is not completed, and clear visibility for the responsible adult.",
    ],
    callout: {
      label: "System model",
      title: "Human authority; machine execution.",
      body: "The institution or family defines the obligation to learn. The AI carries out the instructional process, measures progress, and surfaces exceptions. Human attention is then concentrated where judgment, care, safety, or physical presence is required.",
    },
  },
  {
    heading: "If instruction becomes autonomous, staffing economics change",
    paragraphs: [
      "Schools currently need many subject teachers because teaching capacity scales with teacher time. If an AI system can independently handle diagnosis, explanation, practice, feedback, assessment, review, and adaptation for each learner, the number of adults needed for instruction no longer has to scale in the same way.",
      "That does not mean schools become adult-free. Supervision, child protection, conflict resolution, physical activities, laboratory work, special needs, social development, and accountability can still require people. But the staffing model could shift from “many adults teaching groups” toward “many AI tutors teaching individuals, with fewer adults supervising and handling exceptions.”",
    ],
  },
  {
    heading: "Job reduction would be an outcome, not the measurement target",
    paragraphs: [
      "It is plausible that sufficiently capable AI would reduce demand for some forms of routine instructional labor. It is not responsible to turn a number such as 50% or 90% into a present-day forecast. The useful question is more precise: which teaching tasks can be delegated, for which learners, in which subjects, for how long, and with what level of human oversight?",
      "Those answers can change the labor structure naturally. If one adult can safely supervise a learning environment in which each student receives high-quality individualized instruction from AI, fewer human hours may be required to deliver the same or better instructional output.",
    ],
  },
  {
    heading: "Instructional autonomy is the quantity worth measuring",
    paragraphs: [
      "A future evaluation system should move beyond a single tutor score and ask how much of a teaching process an AI can own without a human teacher repairing its work. A possible progression is:",
      "The final level is the one that matters for structural change. If it becomes reliable, teaching and supervision no longer need to be performed by the same person.",
    ],
    progression: [
      { label: "Assistance", text: "answer questions and provide explanations." },
      { label: "Guided tutoring", text: "diagnose and adapt within a human-designed lesson." },
      { label: "Independent lesson delivery", text: "teach a bounded objective end to end." },
      { label: "Longitudinal adaptation", text: "maintain a learner model and plan across sessions." },
      { label: "Instructional autonomy", text: "sustain learning outcomes over time with human supervision but without routine human teaching." },
    ],
  },
  {
    heading: "A research program, not a prediction",
    paragraphs: [
      "The ambition is to make high-quality individualized teaching computationally scalable. Whether that ultimately automates a small share or a very large share of instructional work should be an empirical result, not a slogan.",
      "Teachometry's role is to make the boundary visible: what AI can teach reliably today, what still requires human intervention, and how that boundary moves as systems improve.",
    ],
  },
];



const WHEN_LEARNING_FEELS_LIKE_FAILURE: BlogArticle = {
  category: "Perspective",
  publishedDate: LEARNING_FAILURE_PUBLISHED_DATE,
  title: "When Learning Starts to Feel Like Failure",
  description: "Why students can fall from confusion into disengagement, why distant rewards often fail to restore motivation, and why an AI tutor may need to make learning psychologically safe before it can make it more efficient.",
  excerpt: "Students do not always stop caring because they lack ambition. Sometimes learning has become a repeated experience of confusion, exposure, and failure.",
  route: "/blog/when-learning-starts-to-feel-like-failure/",
  image: "blog-learning-failure-hero.webp",
  imageAlt: "A classroom desk with a heavily revised mathematics notebook in warm late-afternoon light",
  sections: LEARNING_FAILURE_SECTIONS,
  pullQuote: "The first promise of AI education may be a place where saying “I do not understand” carries almost no social cost.",
  evidenceBoundary: "This essay presents a product and educational hypothesis, not a benchmark result or clinical claim. TutorBench does not currently establish that AI tutoring reduces school disengagement, improves student mental health, restores motivation, or produces long-term academic gains. Those questions require learner studies, longitudinal evidence, appropriate safeguarding, and human-subject research beyond current Tutor Health evaluation.",
};

const CLASSROOM_DOES_NOT_NEED_ROBOTS: BlogArticle = {
  category: "Perspective",
  publishedDate: CLASSROOM_INTERFACE_PUBLISHED_DATE,
  title: "The Classroom Does Not Need 30 Robots",
  description: "Why one-to-one AI tutoring may need a new classroom interface: paper-like digital writing, private voice channels, supervised mastery checks, and evidence-rich practice.",
  excerpt: "The future classroom may not need a robot teacher. It may need a private Tutor channel at every desk and a learning surface that can preserve how understanding develops.",
  route: "/blog/the-classroom-does-not-need-30-robots/",
  image: "home-blog-03.webp",
  imageAlt: "A quiet study desk representing an individual learning surface",
  sections: CLASSROOM_INTERFACE_SECTIONS,
  pullQuote: "The future classroom may not need thirty robots. It may need thirty private learning channels.",
  evidenceBoundary: "This essay is a product and classroom-design hypothesis, not a benchmark result. TutorBench does not currently measure handwriting dynamics, infer learner mastery from ink traces, validate this proposed classroom architecture, or establish learning gains from supervised check / Tutor / transfer loops. Those claims require separate prototype, classroom, usability, and learner-outcome evidence.",
};

const WHY_TEACHING_DOES_NOT_SCALE: BlogArticle = {
  category: "Perspective",
  publishedDate: BLOG_PUBLISHED_DATE,
  title: "Why Teaching Does Not Scale",
  description: "Why individualized teaching attention is scarce, what private tutoring reveals, and why AI teaching must be measured before it can be trusted.",
  excerpt: "The fundamental constraint in education is not access to information. It is access to sustained, individualized teaching attention.",
  route: "/blog/why-teaching-does-not-scale/",
  image: "home-blog-01.webp",
  imageAlt: "A sunlit desk with a notebook, pen, and coffee beside a window",
  sections: WHY_TEACHING_SECTIONS,
  pullQuote: "The fundamental constraint in education is not access to information. It is access to sustained, individualized teaching attention.",
  evidenceBoundary: "This essay is a project thesis, not a benchmark result. The current benchmark evaluates observable tutoring behavior. Long-term learning gain, retention, transfer, autonomous K12 teaching, and workforce effects require separate empirical validation.",
};

const TEACHING_AND_SUPERVISION: BlogArticle = {
  category: "Perspective",
  publishedDate: BLOG_PUBLISHED_DATE,
  title: "Teaching and Supervision Are Different Jobs",
  description: "Why AI may unbundle instruction from supervision, and how instructional autonomy could reshape education without pretending human responsibility disappears.",
  excerpt: "A teacher's job bundles instruction with authority, supervision, safety, social coordination, and responsibility. AI may be able to unbundle those functions.",
  route: "/blog/teaching-and-supervision-are-different-jobs/",
  image: "home-blog-02.webp",
  imageAlt: "A sunlit garden path leading through trees toward a school-like building",
  sections: TEACHING_AND_SUPERVISION_SECTIONS,
  pullQuote: "Human authority; machine execution.",
  evidenceBoundary: "This essay describes a possible system architecture and labor consequence. It does not establish that current AI systems can autonomously teach K12 students, provide adequate supervision, or replace any specific share of education jobs.",
};

/** Explicit editorial metadata is the source for the index and Home cards. */
export const BLOG_POSTS = [
  WHEN_LEARNING_FEELS_LIKE_FAILURE,
  CLASSROOM_DOES_NOT_NEED_ROBOTS,
  WHY_TEACHING_DOES_NOT_SCALE,
  TEACHING_AND_SUPERVISION,
] as const;

function page(
  title: string,
  description: string,
  route: string,
  content: string,
): SitePage {
  return { title, description, route, content };
}

function renderBotanical(): string {
  return renderEditorialBotanical("blog-botanical");
}

function renderPostCard(post: BlogPostSummary): string {
  return `<article class="blog-post-card"><a href="${e(post.route)}"><img src="/assets/${e(post.image)}" width="1672" height="941" loading="lazy" alt=""><div class="blog-post-card-copy"><p class="blog-post-meta">${e(post.category)} <span>·</span> ${e(post.publishedDate)}</p><h3>${e(post.title)}</h3><p>${e(post.excerpt)}</p><span class="text-link">Read the essay ${icon("arrow")}</span></div></a></article>`;
}

/** Stable, human-readable anchors keep the generated TOC usable under any base path. */
export function articleHeadingId(heading: string): string {
  const id = heading
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return id.length > 0 ? id : "section";
}

function renderArticleToc(article: BlogArticle, mobile = false): string {
  const navigation = `<nav class="article-toc${mobile ? " article-toc-mobile-nav" : " article-toc-desktop"}" aria-label="On this page">
    <p class="eyebrow">On this page</p>
    <ol>${article.sections.map((section) => `<li><a href="#${e(articleHeadingId(section.heading))}">${e(section.heading)}</a></li>`).join("")}</ol>
  </nav>`;
  return mobile
    ? `<details class="article-toc-disclosure"><summary>On this page</summary>${navigation}</details>`
    : navigation;
}

function renderArticleCallout(callout: BlogCallout, evidence = false): string {
  return `<aside class="article-callout${evidence ? " article-evidence-boundary" : ""}" aria-label="${e(callout.label)}">
    <p class="eyebrow">${e(callout.label)}</p>
    ${callout.title === undefined ? "" : `<h3>${e(callout.title)}</h3>`}
    <p>${e(callout.body)}</p>
  </aside>`;
}

function renderArticleSection(section: BlogArticleSection): string {
  const progression = section.progression === undefined
    ? ""
    : `<ul class="article-progression">${section.progression.map((item) => `<li><strong>${e(item.label)}:</strong><span>${e(item.text)}</span></li>`).join("")}</ul>`;
  return `<section class="article-section" aria-labelledby="${e(articleHeadingId(section.heading))}">
    <h2 id="${e(articleHeadingId(section.heading))}">${e(section.heading)}</h2>
    ${section.paragraphs.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}
    ${progression}
    ${section.callout === undefined ? "" : renderArticleCallout(section.callout)}
  </section>`;
}

function findArticleNeighbor(article: BlogArticle, offset: -1 | 1): BlogArticle | undefined {
  const index = BLOG_POSTS.findIndex((post) => post.route === article.route);
  return index === -1 ? undefined : BLOG_POSTS[index + offset];
}

function renderArticleNeighbor(post: BlogArticle | undefined, direction: "previous" | "next"): string {
  if (post === undefined) {
    return "";
  }
  const label = direction === "previous" ? "Previous article" : "Next article";
  const arrow = direction === "previous" ? icon("left") : icon("right");
  return `<a class="article-nav-link article-nav-${direction}" href="${e(post.route)}" aria-label="${e(`${label}: ${post.title}`)}">
    <img src="/assets/${e(post.image)}" width="120" height="78" loading="lazy" alt="">
    <span class="article-nav-copy"><span class="article-nav-label">${label} ${arrow}</span><strong>${e(post.title)}</strong></span>
  </a>`;
}

function renderArticleNavigation(article: BlogArticle): string {
  return `<nav class="article-nav" aria-label="Article navigation">
    ${renderArticleNeighbor(findArticleNeighbor(article, -1), "previous")}
    <a class="article-nav-index" href="/blog/"><span>${icon("grid")}</span><span>Back to all posts</span></a>
    ${renderArticleNeighbor(findArticleNeighbor(article, 1), "next")}
  </nav>`;
}

function renderArticleTransition(): string {
  return `<section class="article-ideas" aria-labelledby="article-ideas-title"><div class="shell article-ideas-grid">
    <div><p class="eyebrow">Ideas to evidence</p><h2 id="article-ideas-title">Better questions lead<br><em>to better measurement.</em></h2></div>
    <div class="article-ideas-copy"><p>The <a href="/blog/">Blog</a> explores ideas and perspectives. The <a href="/methodology/">Methodology</a> explains evaluation procedures, the <a href="/data/">Benchmark</a> exposes structured cases and data, and <a href="/leaderboard/">Results</a> contain evidence when it is actually publishable.</p><div class="article-ideas-actions"><a class="button button-primary" href="/data/">Explore the benchmark ${icon("arrow")}</a><a class="button button-secondary" href="/blog/">Read more essays ${icon("arrow")}</a></div></div>
  </div></section>`;
}

function renderBlogArticlePage(article: BlogArticle, footer = ""): SitePage {
  return page(
    `${article.title} — Teachometry Blog`,
    article.description,
    article.route,
    `<article class="blog-article" aria-labelledby="article-title">
      <header class="article-hero"><div class="shell article-hero-grid"><div class="article-hero-copy">
        <a class="article-back-link" href="/blog/">${icon("left")}<span>Blog</span><span aria-hidden="true">/</span><span>Back to all posts</span></a>
        <p class="article-post-meta">${e(article.category)} <span aria-hidden="true">·</span> ${e(article.publishedDate)}</p>
        <h1 id="article-title">${e(article.title)}</h1>
        <p class="lede">${e(article.excerpt)}</p>
      </div><div class="article-hero-art" aria-hidden="true">${renderBotanical()}<p class="article-handwritten">Questions before<br>conclusions.</p><span class="article-art-rule"></span></div></div></header>
      <div class="shell article-media-shell"><figure class="article-media"><img src="/assets/${e(article.image)}" width="1672" height="941" fetchpriority="high" alt="${e(article.imageAlt)}"></figure></div>
      <div class="shell article-mobile-toc">${renderArticleToc(article, true)}</div>
      <div class="shell article-layout"><aside class="article-rail">${renderArticleToc(article)}<div class="article-pull-quote"><p>“${e(article.pullQuote)}”</p></div></aside><div class="article-content">${article.sections.map(renderArticleSection).join("")}${renderArticleCallout({ label: "Evidence boundary", body: article.evidenceBoundary }, true)}</div></div>
      <div class="shell article-nav-shell">${renderArticleNavigation(article)}</div>
    </article>
    ${renderArticleTransition()}
    ${footer}`,
  );
}

export function renderBlogIndexPage(footer = ""): SitePage {
  const featuredPost: BlogArticle = BLOG_POSTS[0];
  const latestPosts: readonly BlogArticle[] = BLOG_POSTS.slice(1);
  return page(
    "Blog — Teachometry",
    "Long-form notes on AI teaching, measurement, instructional autonomy, and the future structure of education.",
    "/blog/",
    `<div class="blog-index">
      <section class="blog-hero" aria-labelledby="blog-title"><div class="shell blog-hero-grid"><div class="blog-hero-copy"><p class="eyebrow">Teachometry Blog <span aria-hidden="true">→</span></p><h1 id="blog-title">Ideas that should become<br><em>testable questions.</em></h1><p class="blog-hero-lede">The benchmark should stay evidence-first. The blog is where we make the underlying hypotheses explicit: what teaching is, what AI might change, and what would have to be measured before stronger claims are justified.</p><div class="blog-hero-actions"><a class="button button-primary" href="#latest-essays">Browse the essays ${icon("arrow")}</a><a class="button button-secondary" href="/methodology/">See the methodology ${icon("arrow")}</a></div></div><div class="blog-hero-art">${renderBotanical()}<p class="blog-handwritten blog-hero-note">Better evidence.<br>Brighter learning.</p><div class="blog-hero-rail"><span>Ideas<br>Evidence<br>Human learning<br>Future questions.</span><i></i></div></div></div></section>
      <section class="blog-feature-section" aria-labelledby="featured-essay-title"><div class="shell blog-feature-grid"><article class="blog-featured"><a class="blog-featured-link" href="${e(featuredPost.route)}"><figure class="blog-featured-media"><img src="/assets/${e(featuredPost.image)}" width="1672" height="941" fetchpriority="high" alt=""></figure><div class="blog-featured-copy"><p class="blog-post-meta">${e(featuredPost.category)} <span>·</span> ${e(featuredPost.publishedDate)}</p><h2 id="featured-essay-title">${e(featuredPost.title)}</h2><p>${e(featuredPost.excerpt)}</p><span class="text-link">Read the essay ${icon("arrow")}</span></div></a></article><aside class="blog-journal-note"><p class="eyebrow">Journal premise</p><h2>Questions before conclusions.</h2><p>The Teachometry Blog is a place for the ideas behind the benchmark: perspectives on teaching, AI, education, and measurement that should eventually become testable.</p><div class="blog-note-rule" aria-hidden="true"></div><nav aria-label="Editorial links" class="blog-note-links"><a href="/methodology/">How we measure ${icon("arrow")}</a><a href="/data/">Explore the benchmark ${icon("arrow")}</a></nav></aside></div></section>
      <section class="blog-latest-section" id="latest-essays" aria-labelledby="latest-essays-title"><div class="shell blog-latest-grid"><div class="blog-latest-main"><div class="blog-section-heading"><div><p class="eyebrow">The journal</p><h2 id="latest-essays-title">Latest essays</h2></div><span class="blog-post-count">Current perspectives</span></div><div class="blog-post-list${latestPosts.length === 1 ? " blog-post-list-single" : ""}">${latestPosts.map(renderPostCard).join("")}</div></div><aside class="blog-editorial-panel"><figure class="blog-editorial-image"><img src="/assets/home-blog-03.webp" width="1672" height="941" loading="lazy" alt=""></figure><div class="blog-editorial-copy"><p class="eyebrow">Editorial boundary</p><h2>Hypotheses are not benchmark results.</h2><p>These essays describe a long-run research direction. They do not establish that current AI systems have demonstrated:</p><ul><li>long-term learning gains</li><li>retention or transfer</li><li>autonomous K12 teaching</li><li>workforce replacement</li><li>real classroom effectiveness</li></ul><p class="blog-editorial-footnote">Those remain empirical questions. The benchmark keeps observable tutoring evidence separate from these broader claims.</p></div></aside></div></section>
      <section class="blog-evidence-section" aria-labelledby="blog-evidence-title"><div class="shell blog-evidence-grid"><div><p class="eyebrow">A working distinction</p><h2 id="blog-evidence-title">Make the idea clear.<br><em>Then make it measurable.</em></h2></div><p>The Blog holds the hypotheses; Benchmark and Methodology hold the procedures and observable evidence. Keeping those surfaces distinct is part of the work.</p><div class="blog-evidence-actions"><a class="button button-secondary" href="/data/">View the benchmark ${icon("arrow")}</a><a class="text-link" href="/about/">About Teachometry ${icon("arrow")}</a></div></div></section>
      ${footer}
    </div>`,
  );
}

export function renderWhenLearningStartsToFeelLikeFailurePage(footer = ""): SitePage {
  return renderBlogArticlePage(WHEN_LEARNING_FEELS_LIKE_FAILURE, footer);
}

export function renderClassroomDoesNotNeedRobotsPage(footer = ""): SitePage {
  return renderBlogArticlePage(CLASSROOM_DOES_NOT_NEED_ROBOTS, footer);
}

export function renderWhyTeachingDoesNotScalePage(footer = ""): SitePage {
  return renderBlogArticlePage(WHY_TEACHING_DOES_NOT_SCALE, footer);
}

export function renderTeachingAndSupervisionPage(footer = ""): SitePage {
  return renderBlogArticlePage(TEACHING_AND_SUPERVISION, footer);
}
