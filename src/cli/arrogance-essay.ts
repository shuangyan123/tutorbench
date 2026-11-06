/**
 * Journal essay "Arrogance Is Not What You Need" (傲慢是你所不需要的), 2026-11-06.
 * Editorial argument, not TutorBench benchmark evidence. The Chinese is the original; the English is a
 * parallel translation with the same paragraphs, so the two languages line up one to one.
 * A paragraph starting with "> " is a spoken line set apart; [n] (English) and 〔资料n〕 (Chinese) cite source n.
 * Rendered by website/prototypes/spectrum/tools/build-journal.mjs; metadata in src/cli/blog-series.ts.
 */
export const ARROGANCE_ESSAY = {
  "slug": "arrogance-is-not-what-you-need",
  "published": "2026-11-06",
  "en": {
    "title": "Arrogance Is Not What You Need",
    "dek": "When a student cannot learn something, what is it that should change?",
    "description": "“Isn’t this easy? Why can’t you do it?” From a teacher’s blind spot to exam selection and AI tutors: why struggling with one subject should never become a verdict on a person.",
    "boundary": "This is an opinion essay, not a TutorBench result. The studies it cites support specific mechanisms only; its views on policy, its value judgements and its hopes for AI tutoring have not all been tested empirically.",
    "intro": [
      "We have all heard it said:",
      "> “Isn’t this problem easy? Why can’t you do it?”",
      "> “Getting into that university really isn’t that hard. Why didn’t you get in?”",
      "The people who say this usually don’t think they are belittling anyone. To them, these things really are easy. That is especially true of people who did well all the way through school and went on to good universities: a great deal of learning stopped costing them any effort long ago.",
      "That is exactly where the problem lies. Why do we take what comes easily to us and assume it should come just as naturally to everyone else?",
      "Go one step further. A student keeps failing to learn a certain kind of thing. The teacher tries a few times, then decides the student isn’t bright enough, has no talent, isn’t worth any more effort. Is that the student’s failure, or a limit of education?",
      "I want to start from that one sentence, “this is easy.” Behind it is more than one teacher’s blind spot. It is tied to how we rank people, how we define “excellent,” and where education, including today’s AI education, is really trying to take people."
    ],
    "sections": [
      {
        "heading": "“Easy” is how it looks from the finish line",
        "paragraphs": [
          "In 1990, Elizabeth Newton, a graduate student in psychology at Stanford, ran a small experiment. One person tapped out a well-known song with a finger on a table; another person listened to the rhythm and tried to name the song. The tappers guessed that listeners would get about half of them. In fact the listeners got almost none: fewer than three in a hundred [1].",
          "The tapper hears the melody the whole time. The listener hears a string of knocks.",
          "The same thing happens in classrooms all the time. Someone who is very good at mathematics is not necessarily a good mathematics teacher. They see the method at a glance, yet may not understand why a beginner cannot take even the first step, because the melody has long since grown into their head.",
          "Education research has a related idea, the “expert blind spot.” Once you have known something long enough, many steps of thinking become automatic: complex reasoning happens without effort, and you forget how many intermediate steps it once took.",
          "In a 2003 study, Nathan and Petrosino asked 48 preservice secondary teachers to judge how hard a set of algebra problems would be for students. The deeper a participant’s mathematics background, the more likely they were to believe that students must master symbolic equations before they can solve word problems. Students’ actual performance pointed the other way: many beginning algebra students found a problem told as a story easier than a bare symbolic equation with the same structure [2].",
          "This does not mean knowledgeable people necessarily teach badly. It means that knowing something and understanding someone who does not know it yet are two different abilities.",
          "An example. Ask a student which is bigger, 0.3 or 0.25. The answer: 0.25.",
          "To an adult this is about as “easy” as a question gets. But the answer is not a random guess: 25 is bigger than 3, so 0.25 must be bigger than 0.3. The student is probably reading the digits after the decimal point as a whole number, and has not yet really understood what “tenths” and “hundredths” mean.",
          "The answer is wrong, but the thinking has its own logic. A teacher who only repeats “compare the tenths first” may never reach the real problem.",
          "So I think a good teacher needs a particular ability: not only to get from the question to the right answer, but to work backwards from a student’s wrong answer to how the student might have been thinking."
        ]
      },
      {
        "heading": "Try to become that student",
        "paragraphs": [
          "We often say teachers should understand students, care about them, have empathy. The understanding I mean goes much deeper than comfort.",
          "It asks the teacher to go back, as far as possible, to the state of knowledge the student is in: to set aside for a while the ideas they have mastered and the student has not, and to start from what the student already knows, working out again how the student would understand the problem. It almost asks the teacher, while thinking, to become that student.",
          "Of course, no one can have another person’s whole experience, and a teacher should not decide from a single mistake that they know exactly what a student is thinking. So this understanding is not mind reading. It is a cycle of guessing, checking and guessing again.",
          "Take the decimal question again. The teacher can begin by asking: how did you compare them? If the student says “25 is bigger than 3,” ask a question that tests the guess: what about 0.3 and 0.30, which is bigger? If the student says 0.30, the guess is supported: they really are reading what comes after the point as a whole number. If they say the two are equal, the problem may lie elsewhere, so make a different guess and keep asking.",
          "If the guess is right, what comes next may not be the rule explained once more but a different way in. Try money: $0.30 is thirty cents, $0.25 is a quarter. Which is more? If the student answers at once, the trouble was never comparing sizes. They simply hadn’t connected decimals to something they already knew well.",
          "A student may need not more explanation but a completely different one. They may already understand most of it and be stuck at one particular step. A teacher who does not see this and keeps starting again from the beginning can easily turn the lesson into a frustration they both share.",
          "And this understanding is not only about thinking.",
          "A student who hasn’t raised a hand for a long time may not have understood, or may be afraid of being wrong. Perhaps they were laughed at. Perhaps they are used to being compared with stronger classmates. Perhaps they long ago tied every right or wrong answer to the question of whether they are clever.",
          "To a teacher, “you can’t even do something this simple?” may be a passing remark. To a student who has failed again and again, it confirms the old thought once more:",
          "> “I’m just someone who can’t learn.”",
          "Empathy in teaching is not feeling sorry for a student. It is seeing how their gaps in knowledge, their feelings and their past experiences together shape how they are learning right now. And it has to end in action: however gentle the manner, if it cannot see where the student is stuck, it is not effective teaching."
        ]
      },
      {
        "heading": "From “can’t solve this” to “can’t be taught”",
        "paragraphs": [
          "One of the things education should be most wary of is turning one piece of learning into a judgement of the whole person.",
          "A student fails to follow a problem a few times in a row, and we start to think they are slow. Their marks stay low for a long time, and we decide they lack the ability to learn. In the end some people reach for innate intelligence or the structure of the brain to explain it, and then lose patience with a clear conscience.",
          "There is a dangerous leap in that chain. That a student cannot learn something now does not mean we have found every cause of the difficulty, still less that their potential has been accurately measured.",
          "People do differ: in cognitive ability, in neurological development, in how fast they learn. Some students need more time, some need more concrete pictures or hands-on work, and some have specific learning difficulties that call for professional assessment and support. We cannot promise that if a teacher is patient enough, everyone will reach the same academic level.",
          "But difference cannot become a reason to give up. Not reaching a level yet does not mean a person has run out of room to grow.",
          "When a way of teaching keeps failing, the first things to look at are the method, the starting point it assumed, the learning environment and the support around it, not a verdict that the student is hopeless. Above all, a teacher should not turn “I haven’t understood this student” into “this student is no good.”",
          "Good teachers have limits too. Complex difficulties may need other teachers, special education professionals, families and schools working together. A professional limit should lead to better support, not to humiliating the student.",
          "But a more basic question is hidden here. Why is someone who does badly in mathematics, in languages or in some other theoretical subject so easily seen as “not clever,” even “not good enough”? When did we start treating performance in one subject as a verdict on the whole person?"
        ]
      },
      {
        "heading": "Where we learned that leap",
        "paragraphs": [
          "Part of the answer, I think, lies in how we hand out opportunities.",
          "In China we keep speaking of educating the whole person: morally, intellectually, physically, aesthetically and through work. But when the important places in further education are actually handed out, what decides is usually a handful of exam subjects and a score that can be counted.",
          "So a contradiction appears. Our ideals of education accept that human abilities are many; the selection system makes everyone compete on a few concentrated measures. When one measure directly decides university admission, educational resources and future opportunities, students, families and schools naturally arrange their time around it.",
          "A student who loves drawing knows the piles of practice papers come first. A teacher who believes sport and art matter still has to put more energy into the class’s admission results. The slogans can keep saying “all-round development”; the real investment flows to the part with the most power to select.",
          "Strictly speaking, what we prize is not even intellect in the full sense. A standardised exam can assess some subject knowledge, some reasoning and the ability to complete set tasks. It cannot measure creativity, taste, practical skill or an understanding of people and society, and still less everything a person might become.",
          "When a measurable score becomes the main basis for selection, it is easy to mistake it for the main outcome of education. One step further, and “scored well” quietly becomes “is a better person.”",
          "Which brings us back to the sentence we began with.",
          "Some of the people who scored well all the way through slowly develop a sense of superiority: if I can do it and others can’t, it must be because they didn’t try hard enough or aren’t clever enough. They may not notice that people’s foundations, family circumstances, surroundings, chances to practise and individual abilities were never the same to begin with.",
          "Personal effort deserves respect. But people who succeed cannot use their own story as the ruler for everyone else.",
          "Especially in teaching, an advantage in knowledge should not become a sense of personal superiority. Knowing more does not make someone more deserving of respect than a person who knows less."
        ]
      },
      {
        "heading": "The exam is not the enemy",
        "paragraphs": [
          "It would be easy, at this point, to conclude that exams should be abolished. I don’t think so.",
          "Exams have a fairness that should not be ignored. Compared with selection that rests entirely on family background, connections, recommendations or impressions, a public syllabus and public marking give people from different backgrounds a relatively transparent chance to compete. Select by portfolios, all-round assessments, community work or interviews instead, and you face differences in family resources, subjective judgement and unequal opportunity all the same.",
          "The trouble with exams is not that they have no value. It is that we ask them to carry more than they can. An exam can help decide how some educational opportunities are shared out. It should not, for that reason, define all of a person’s abilities and worth.",
          "So what needs to change is not only the set of measures. Society needs to offer more paths with real room to grow, and one round of selection should lock in less of a person’s long-term chances.",
          "Theoretical study, art, sport, vocational skills, engineering practice: none of these should be what is left over after “the score wasn’t high enough.” Each deserves good teaching and resources, room to grow and the respect it is due. Missing the university you hoped for at one point in life does not mean you can never study again, change direction or find another chance.",
          "The aim of education should not be to fix people in a rank as early as possible, but to widen, as far as it can, the choices they will be able to make."
        ]
      },
      {
        "heading": "Ask a different question: what do you want to make?",
        "paragraphs": [
          "So suppose we have honestly tried different ways of teaching, understood the student’s difficulties and given reasonable support, and they still struggle to meet some theoretical standard. What then?",
          "Do we keep them drilling until they scrape past the common bar? Or, having confirmed they have “no strengths,” treat them as one of education’s failures?",
          "I think that is the moment to change the question itself. Not only “why can’t they learn this,” but also: apart from what the exam requires, what do they like? What are they curious about? What do they want to do, to make, to experience?",
          "Some people love mechanisms; some love drawing, music or sport; some are drawn to working with people; some have a strong curiosity about the natural world. These interests should not be treated as pastimes for after the real learning, still less as a fallback for people short of academic ability. In their own right they involve careful observation, judgement, making and long practice. A student who can design an ingenious mechanical device does not lose the value of that creativity because a certain kind of abstract mathematics problem is hard for them.",
          "But there is another mistake to avoid. Being bad at mathematics is no reason to decide for a student that they should study art, and finding theory hard is no reason to close the door on their coming back to it later. Respecting difference does not mean sorting students into places early. It means giving them the right to explore different directions, and the right to choose again later.",
          "Foundations in reading, mathematics and science still matter, because they widen a person’s ability to understand the world and take part in society. But giving everyone a common foundation is one thing; requiring everyone to reach the same competitive level in the same field is another.",
          "In fact this question does not belong only to students who “do badly.” From primary school to the end of secondary school, most learning is organised around courses, homework and exams decided in advance. We are told to master a formula, memorise a passage, finish a set of problems, and rarely get to decide what we want to explore.",
          "There is sense in this: beginners cannot know in advance what is worth learning, and public education has to provide a shared foundation. But if learning can only ever start from tasks set from outside, a person’s imagination and interests wait at the back of the queue for a very long time.",
          "I would really like to know what a child would say if we asked: “Forget exams, university and jobs for a moment. What would you most like to create?”",
          "Perhaps a world that doesn’t exist, a strange machine, a game, a dive into the deep sea, or a drawing of the city in their head. These wishes may have no economic value and may never become a job. But why must education first prove that an interest is “useful” before it lets someone take it seriously?",
          "Sometimes students are not unwilling to learn; they just can’t see what the material has to do with their lives, goals or wishes. A student who wants to make a game, and wants the characters to run and jump the way they imagine, may find that coordinates, functions and physics stop being tasks imposed from outside and become tools for building their idea.",
          "That doesn’t guarantee they will come to love all of mathematics, and interest is no substitute for sustained practice. But the meaning of learning has changed: knowledge is no longer only something for passing an exam. It can also be the power to make something you imagined.",
          "On motivation, self-determination theory stresses three basic psychological needs: autonomy, competence and relatedness. A 2024 systematic review and meta-analysis of more than thirty studies found that educational interventions based on the theory raised students’ sense of autonomy and competence and had partly positive effects on intrinsic motivation, but showed no significant overall effect on relatedness, and results varied widely between studies [3]. Another meta-analysis, covering more than six hundred student samples, found that teacher behaviour supporting these three needs goes together with better performance, engagement and well-being; most of those data are correlational, though, and cannot show cause and effect [4]. So the research does not prove that interest-led learning is always more effective.",
          "Nor do I hope for learning without difficulty. I hope students get the chance to see why a particular difficulty is worth overcoming."
        ]
      },
      {
        "heading": "AI tutors can learn arrogance too",
        "paragraphs": [
          "All of this has made me think again about AI in education.",
          "Using AI to help students understand concepts, find their mistakes, practise question types and raise their marks meets real and important needs. But if AI education ends up with only one goal, getting students into higher-ranked schools, it may only make the existing selection machine run faster, without touching what we actually care about.",
          "There is something more worrying still: AI can learn the same arrogance.",
          "For a large language model, almost no school mathematics problem is hard. It is very nearly the perfect “expert”: it sees the answer at once, yet may not see where the student is stuck. Jumping straight to the correct steps the moment it spots a mistake, or repeating the same explanation in other words, is the machine’s version of “this is easy, why can’t you do it?”",
          "What I would rather see is AI education that first learns to understand the learner. Not recording their score, not sorting them into clever and not clever by the number of mistakes, but trying to rebuild their current state of knowledge: why they reached this answer, which help actually worked, and revising that judgement as new evidence comes in. Like the decimal question earlier: first ask “how did you compare them?”, then use one more question to test the guess.",
          "When a learner keeps failing, it should not mechanically repeat the same explanation, nor give up because progress has been slow for a long time. It can try a different picture, go back to a more basic idea, design different practice, or admit that the current approach is not working and that other teaching support is needed.",
          "Nor should it merely sound empathetic. Understanding worth having shows in accurate diagnosis, respectful responses and teaching actions that can be checked.",
          "One study is worth remembering. A field experiment in high-school mathematics with nearly a thousand students, published in PNAS in 2025, found that GPT help without teaching safeguards raised students’ practice scores sharply while they had the AI, but once the AI was taken away their exam scores were lower than those of students who never had it; a tutoring version with teaching safeguards largely removed that harm [5]. An AI helping a student get a problem done and the student actually knowing how are two different things.",
          "This is exactly what we are building TutorBench to test: when an AI tutor faces a particular student and a particular mistake, can it diagnose where the misunderstanding lies, guide the student to reason for themselves, adapt its help to that student and leave the thinking with them, rather than simply produce a correct answer?",
          "Beyond solving problems, AI can also help people explore interests and directions. A student may be worrying about a mathematics exam while being passionate about animation, robots or making music. AI can help them find the relevant knowledge and courses, design small projects they can actually finish, and learn new theory and skills as the making requires.",
          "None of this means AI can already understand a person fully, still less that it can replace teachers, peers, families and real experience of the world. The deeper a system reaches into an individual’s learning, the more carefully it must handle misjudgement, privacy, autonomy and educational responsibility.",
          "If an AI labels a student “not a maths person” too early, and then keeps narrowing their contact with mathematics on that basis, it has only repeated, more precisely, the labelling that worries us most in traditional education.",
          "Personalised education should widen what people can become, not use their past performance to fix their future in advance."
        ]
      },
      {
        "heading": "What counts as a successful education",
        "paragraphs": [
          "Suppose a student studies for many years and still does not meet the requirements of a certain exam, but slowly works out what they love, gains a craft worth treasuring, can make things they care about, and is able to keep learning new things. Has their education failed?",
          "Suppose another student has excellent marks but never understands other people’s difficulties, looks down on those with lower marks, and even loses their curiosity about the world. Can we call their education a complete success on the strength of their scores alone?",
          "No new scoring system can answer these questions. They are about how we understand a person’s growth.",
          "Education cannot remove every difference, nor guarantee that everyone achieves all they hope for. People still need shared knowledge, practical skills, a sense of responsibility to others, and the ability to do things they don’t like but have to do. But none of these should let education shrink into an endless process of screening, ranking and weeding people out.",
          "I hope good education holds at least this attitude:",
          "When a student doesn’t understand, first find out properly why.",
          "When a way of teaching doesn’t work, keep looking for another rather than writing the student off.",
          "When a student really isn’t good at a field, still help them build the foundations they need, and give them the chance to find other directions worth their effort.",
          "When a student has interests and talents outside the mainstream measures, don’t require them to prove themselves in some exam before letting them develop those abilities seriously.",
          "And when a person can already choose, learn and create on their own, education should step back into a supporting role and stop deciding for them where their life should go.",
          "Perhaps what matters most in education is not bringing everyone to the same place in the end, but letting each person gradually understand the world, discover what they want to do, and gain as much ability and opportunity as possible to do it.",
          "A good teacher, standing higher, does not look down on those who have not got there yet.",
          "A good education system should not decide that someone has no future worth developing because they did not arrive where it expected them to."
        ]
      }
    ]
  },
  "zh": {
    "title": "傲慢是你所不需要的",
    "dek": "当一个学生学不会，该被改变的是什么？",
    "description": "“这道题不是很简单吗？你怎么做不出来？”从老师的专家盲点，到考试选拔，再到 AI 辅导：为什么一门课学不会，不该变成对一个人的判决。",
    "boundary": "本文是观点文章，不是 TutorBench 的评测结果。文中引用的研究只用来支撑具体的机制；文章里的政策主张、价值判断和对 AI 教育的设想，并没有都经过实证检验。",
    "intro": [
      "我们大概都听过这样的话：",
      "> “这道题不是很简单吗？你怎么做不出来？”",
      "> “考上这所大学其实没那么难，你为什么考不上？”",
      "说这话的人，多半没觉得自己在贬低谁。对他们来说，这些事是真的简单。尤其是一路成绩优秀、进了好大学的人，很多学习任务早就不费力气了。",
      "问题恰恰出在这里：为什么我们会把自己做得轻松的事，当成别人理所当然也该做到的事？",
      "再往前一步：如果一个学生始终学不会某类知识，老师试过几次之后，就认定他不够聪明、没有天赋、不值得再花力气，这是学生的失败，还是教育的局限？",
      "我想从“这很简单”这句话说起。它背后不只是一个老师的盲点，还连着我们怎样给人排序、怎样定义“优秀”，以及教育（包括今天的 AI 教育）究竟想把人带到哪里去。"
    ],
    "sections": [
      {
        "heading": "“简单”，是站在终点往回看",
        "paragraphs": [
          "1990 年，斯坦福大学的心理学研究生 Elizabeth Newton 做过一个小实验：一个人用手指在桌上敲出一首大家都熟悉的歌，另一个人只听节奏，猜是哪首歌。敲的人估计，对方大概能猜中一半。结果听的人几乎全猜不出来，猜中的还不到百分之三〔资料1〕。",
          "敲的人脑子里一直响着旋律，听的人只听见一串咚咚声。",
          "课堂上常常发生同样的事。数学很好的人，未必是好的数学老师。他能一眼看出解法，却不一定明白一个初学者为什么连第一步都迈不出去，因为那段旋律早就长在他脑子里了。",
          "教育研究里有个相近的概念，叫“专家盲点”（expert blind spot）：一种知识掌握久了，很多思考步骤会变得自动化，复杂的推理不假思索就能完成，人却也忘了自己当初经过了多少中间环节。",
          "Nathan 和 Petrosino 在 2003 年的研究里，请 48 位职前中学教师判断一组代数题对学生来说有多难。数学背景越深的人，越倾向于认为学生必须先学会符号方程，才能去解文字应用题。可学生的实际表现正好相反：很多初学代数的学生，解带情境的文字题，反而比解同样结构的纯符号方程更顺利〔资料2〕。",
          "这当然不是说知识丰富的人一定教不好书。它说明的是：自己会，和理解还不会的人，是两种不同的能力。",
          "举个例子。问一个学生：0.3 和 0.25，哪个大？他说：0.25。",
          "在大人看来，这几乎是最“简单”的那类题。可他的答案不是乱猜的：25 比 3 大，所以 0.25 比 0.3 大。他很可能把小数点后面的数字当成了一个整数来比较，还没有真正理解“十分之几”“百分之几”是什么意思。",
          "他的答案错了，但思路有自己的逻辑。如果老师只是一遍遍重复“比小数要先比十分位”，可能永远碰不到真正的问题。",
          "所以我觉得，好老师需要一种特别的能力：不只是从题目推出正确答案，还要能从学生的错误答案，倒推出他可能是怎么想的。"
        ]
      },
      {
        "heading": "试着成为那个学生",
        "paragraphs": [
          "我们常说老师要理解学生、关心学生、有同理心。但我说的理解，比一般意义上的安慰要深得多。",
          "它要求老师尽量回到学生所处的知识状态：暂时放下那些自己已经掌握、而学生还没有的概念，从学生已有的经验出发，重新推一遍他会怎么理解这个问题。几乎是要求老师在思考的时候，变成那个学生。",
          "当然，没有人能真正拥有另一个人的全部体验，老师也不该凭一次错误，就笃定自己知道学生在想什么。所以这种理解不是读心术，而是一个猜测、检验、再修正的过程。",
          "还是那道小数题。老师可以先问：你是怎么比的？如果他说“25 比 3 大”，就再问一个能检验这个猜测的问题：那 0.3 和 0.30 呢，哪个大？如果他说 0.30 大，猜测就得到了支持，他确实是把小数点后面当成整数在看。如果他说一样大，问题可能在别处，那就换一个猜测，接着问。",
          "猜对了，接下来需要的也许不是把规则再讲一遍，而是换一种讲法。比如换成钱：0.3 元是三角，0.25 元是两角五分，哪个多？如果他马上答对了，说明他不是不会比大小，只是还没把小数和自己早就懂的东西连起来。",
          "学生需要的不一定是更多的解释，而可能是完全不同的解释。他也可能已经懂了一大半，只卡在某个具体环节。老师如果没看出这一点，反而一次次从头重讲，教学就很容易变成双方一起受挫。",
          "这种理解也不只关乎认知。",
          "一个学生很久不举手，可能是没听懂，也可能是怕出错。他也许被嘲笑过，也许习惯了和成绩好的同学比，也许早已把一道题的对错和“我聪不聪明”绑在了一起。",
          "对老师来说，“这么简单都不会”可能只是随口一句；可对一个反复失败的学生，它会又一次确认那个念头：",
          "> “我就是学不会的人。”",
          "教学里的共情，不是替学生难过，而是看清他的知识障碍、情绪和过去的经历，怎样一起影响了此刻的学习。它最后还得落到行动上：态度再温柔，认不出学生卡在哪里，也算不上有效的教学。"
        ]
      },
      {
        "heading": "从“这道题不会”到“这个人不行”",
        "paragraphs": [
          "教育里最该警惕的事情之一，是把一次学习表现，变成对一个人的整体评价。",
          "一个学生连着几次听不懂某道题，我们开始觉得他反应慢；他长期成绩差，我们又觉得他没有学习能力；到最后，甚至有人搬出先天智力、大脑结构来解释，然后心安理得地失去耐心。",
          "这中间有一个很危险的跳跃。学生现在学不会，不等于我们已经弄清了困难的全部原因，更不等于他的潜力已经被准确测量过。",
          "人和人之间确实有差异：认知能力、神经发育、学习速度都不一样。有的学生需要更长的时间，有的需要更具体的图示或动手操作，有的存在特定的学习障碍，需要专业的评估和支持。我们没法承诺，只要老师足够耐心，每个人最后都能到达同样的学术水平。",
          "但差异不能成为放弃的理由。一时到不了某个水平，不代表这个人的成长空间已经到头。",
          "一种教法反复失败时，该先回头看的是方法本身、预设的起点、学习环境和支持条件，而不是直接认定学生没希望。尤其要避免的，是老师把“我没能理解他”，说成“他太差”。",
          "好老师也有能力边界。遇到复杂的困难，可能需要其他老师、特殊教育专业人员、家庭和学校一起介入。专业的边界应该把人引向更合适的支持，而不是变成对学生的羞辱。",
          "不过这里还藏着一个更根本的问题：为什么一个人数学、语文或者某种理论学习不好，就那么容易被看成“不够聪明”，甚至“不够优秀”？我们是从什么时候开始，把一门学科里的表现，当成对整个人的判决的？"
        ]
      },
      {
        "heading": "这种跳跃，是从哪里学来的",
        "paragraphs": [
          "我想，答案有一部分藏在我们分配机会的方式里。",
          "我们一直说全面发展，说德智体美劳。可到了真正分配重要升学机会的时候，起决定作用的往往还是少数几门考试科目和可以量化的分数。",
          "于是出现了一种矛盾：教育理念承认人的能力是多样的，选拔机制却让所有人在相对集中的几项指标上竞争。当一项指标直接决定大学录取、教育资源和未来机会时，学生、家庭和学校自然会围着它安排时间。",
          "一个很喜欢画画的学生，知道自己得先把成堆的练习卷做完；一位觉得体育和艺术很重要的老师，也不得不把更多精力放在班级升学率上。口号可以一直喊全面发展，真正的投入却会流向最有选拔效力的那一部分。",
          "严格说来，我们重视的甚至不是完整意义上的“智”。标准化考试能评价一部分学科知识、推理能力和完成任务的水平，却量不出创造力、审美、实践能力、对人和社会的理解，更量不出一个人将来全部的可能。",
          "当可测量的成绩成了最重要的选拔依据，我们就很容易把它错认成最重要的教育成果。再往前一步，“考得好”就悄悄变成了“这个人更优秀”。",
          "这就回到了开头那句话。",
          "一路考得好的人，有一部分会慢慢形成一种优越感：既然我做得到，别人做不到，那一定是别人不够努力、不够聪明。他们未必意识到，每个人的知识基础、家庭条件、成长环境、训练机会和个体能力，本来就不一样。",
          "个人的努力值得尊重。但成功的人，不能把自己的经历直接当成衡量所有人的尺子。",
          "尤其是在教育关系里，知识上的优势不该变成人格上的优越感。一个人知道得更多，并不意味着他比知道得少的人更值得尊重。"
        ]
      },
      {
        "heading": "但考试本身不是敌人",
        "paragraphs": [
          "说到这里，很容易得出“考试应该废除”的结论。我不这么想。",
          "考试有它不能忽视的公平价值。和完全依靠出身、人脉、推荐或主观印象的选拔相比，公开的考试内容和评分标准，至少给了不同背景的人一个相对透明的竞争机会。换成艺术作品、综合素质、社会实践或面试来选拔，同样要面对家庭资源差异、评价主观和机会不均的问题。",
          "考试的问题不在于它没有价值，而在于我们让它承担了超出它能力的任务。它可以帮助决定某些教育机会怎么分配，但不该因此定义一个人全部的能力和价值。",
          "所以要改变的，不只是换一套评价指标，而是让社会提供更多真正有发展空间的路，同时减少一次选拔对一个人长期机会的锁定。",
          "理论学习、艺术创造、体育、职业技能、工程实践，不该只是“分数不够”之后的分流结果。它们都应该有高质量的教育资源、合理的成长空间和应有的社会尊重。一个人某个阶段没进理想的大学，也不意味着他以后不能重新学习、换个方向、等到新的机会。",
          "教育的目标，不该是尽早把人固定在某个等级里，而是尽可能扩大他将来能做的选择。"
        ]
      },
      {
        "heading": "换一个问题：你想做什么？",
        "paragraphs": [
          "那么，假如我们已经认真试过不同的教法，了解了学生的困难，也给了合理的支持，他还是很难达到某种理论学习的要求，接下来呢？",
          "只能让他继续重复训练，直到勉强够上统一标准？或者确认他“没有优势”之后，把他当成教育里的失败者？",
          "我觉得这时候，该换的是问题本身。不只问“他为什么学不会这个”，也问：除了考试要求的知识，他还喜欢什么？对什么好奇？想做什么、造什么、体验什么？",
          "有人喜欢机械结构，有人喜欢画画、音乐或运动，有人热衷于和人打交道，有人对自然现象有很强的好奇心。这些兴趣不该只被当作学习之余的消遣，更不该被看成学术能力不足的人的退路。它们本身就包含复杂的观察、判断、创造和长期训练。一个能设计出精巧机械装置的学生，不会因为不擅长某类抽象数学题，就失去他创造力的价值。",
          "但也要避开另一种错误：不能因为一个学生数学不好，就替他决定该去学艺术；也不能因为他理论学习吃力，就提前关上他将来重新学理论的门。尊重差异，不是提前把学生分配到不同的位置，而是让他们有权探索不同的方向，也有权以后重新选择。",
          "阅读、数学和科学的基础仍然重要，因为它们扩展了一个人理解世界、参与社会的能力。但让每个人都获得共同的基础，和要求所有人在同一个领域达到同一个竞争水平，是两回事。",
          "其实这个问题不只属于“学不好”的学生。从小学到高中，大多数学习都围绕事先规定好的课程、作业和考试展开。我们被告知要掌握某个公式、背某段课文、做完某套题，却很少有机会决定自己想探索什么。",
          "这有它合理的一面：初学者不可能事先知道哪些知识值得学，公共教育也需要提供共同的基础。可如果学习永远只能从外部规定的任务开始，一个人的想象和兴趣就会长期排在后面。",
          "我很想知道，如果我们问一个孩子：“先不想考试、大学和工作，你最想创造一个什么样的东西？”他会怎么回答。",
          "也许是设计一个不存在的世界，造一台奇怪的机器，做一款游戏，去探索深海，或者把脑子里的城市画出来。这些愿望未必有经济价值，也不一定能变成职业。但教育为什么非得先证明一种兴趣“有用”，才允许一个人认真发展它？",
          "有时候，学生并不是不愿意学，而是看不出这些内容和自己的生活、目标、愿望有什么关系。一个想做游戏的学生，希望角色按自己设想的方式跑和跳，坐标系、函数和物理就可能从外部强加的任务，变成实现他想法的工具。",
          "这不保证他会因此爱上所有数学，兴趣也替代不了持续的训练。但学习的意义已经变了：知识不再只是用来通过一场考试的东西，也可以是实现自己想象的能力。",
          "关于学习动机，自我决定理论强调三种基本的心理需要：自主、胜任和归属。2024 年一项汇总了三十多项研究的系统综述与元分析发现，基于这一理论的教育干预能提升学生的自主感和胜任感，对内在动机也有部分积极效果；但对归属感没有显著的总体影响，各研究之间的结果差异也很大〔资料3〕。另一项汇总了六百多个学生样本的元分析发现，老师支持这三种需要的做法，和更好的成绩、投入与幸福感相关；不过这些数据大多是相关性的，说明不了因果〔资料4〕。所以，研究并不能证明“兴趣导向的学习一定更有效”。",
          "我想追求的，也不是让学习没有困难，而是让学生有机会明白：这个困难，为什么值得自己去克服。"
        ]
      },
      {
        "heading": "AI 老师也可能学会傲慢",
        "paragraphs": [
          "这些问题，也让我重新思考 AI 教育。",
          "用 AI 帮学生理解概念、找出错误、练习题型、提高成绩，这些需求真实而重要。但如果 AI 教育最后只剩下一个目标，就是把学生送进排名更高的学校，那它可能只是让原有的选拔体系转得更快，碰不到我们真正关心的问题。",
          "还有一件更值得担心的事：AI 也可能学会同样的傲慢。",
          "对一个大模型来说，绝大多数中学题都不难。它几乎就是最典型的“专家”：一眼看出答案，却未必看得见学生卡在哪里。一看到错误就直接给出正确步骤，或者把同一个解释换几种说法反复讲，这就是机器版的“这很简单，你怎么不会”。",
          "我更希望未来的 AI 教育先学会理解学习者。不是记下他考了多少分，也不是按错题数量把他分成聪明和不聪明两类，而是试着重建他当前的知识状态：他为什么得出这个答案，哪些帮助真正起了作用，并随着新的表现不断修正判断。就像前面那道小数题，先问“你是怎么比的”，再用一个问题去检验自己的猜测。",
          "学习者反复失败时，它不该机械地重复同一个解释，也不该因为长期没有进展就放弃。它可以换一种图示，退回更基础的概念，设计不同的练习，或者承认当前的方法没有奏效，需要别的教学支持。",
          "它也不该只是语气上显得很有共情。有价值的理解，应该体现在准确的诊断、尊重的回应，和经得起检验的教学行动上。",
          "有一项研究值得记住。2025 年发表在《美国国家科学院院刊》（PNAS）上的一项高中数学现场实验，涉及近千名学生：不加教学约束的 GPT 辅助，让学生有 AI 时的练习成绩大幅提高，可一旦撤掉 AI，他们的考试成绩反而比没用 AI 的同学低；加了教学约束的辅导版本，基本缓解了这种负面影响〔资料5〕。AI 能帮学生做出一道题，和学生自己真的会了，是两回事。",
          "这也正是我们做 TutorBench 想测的东西：一个 AI 辅导老师面对具体的学生、具体的错误时，能不能诊断出误解在哪里，引导学生自己推理，根据学生调整帮助，并且把思考留给学生，而不只是给出一个正确答案。",
          "除了解题，AI 还可以帮人探索兴趣和方向。一个学生也许正为数学考试发愁，同时又对动画、机器人或音乐制作充满热情。AI 可以帮他找到相关的知识和课程，设计做得出来的小项目，在创造的过程中按需学新的理论和技能。",
          "但这不意味着 AI 已经能完整理解一个人，更不意味着它能取代老师、同伴、家庭和真实的社会经验。越是深入个人学习状态的系统，越要小心对待误判、隐私、自主权和教育责任。",
          "如果 AI 过早把一个学生标记为“不适合数学”，再据此不断缩小他接触数学的机会，那它只是用更精细的方式，重复了传统教育里最让人担心的标签化。",
          "个性化教育应该扩大人的可能性，而不是根据过去的表现，提前限定一个人的未来。"
        ]
      },
      {
        "heading": "什么才算教育成功",
        "paragraphs": [
          "如果一个学生学了很多年，还是没达到某场考试的要求，但他慢慢弄清了自己喜欢什么，有了一门值得珍惜的手艺，能做出自己喜欢的东西，也有能力继续学新东西，他的教育失败了吗？",
          "如果另一个学生成绩非常好，却始终理解不了别人的困难，把成绩差的人看得低自己一等，甚至对世界失去了好奇，我们能只凭分数，说他的教育完全成功吗？",
          "这些问题没法靠一套新的评分系统回答。它们关乎我们怎样理解一个人的成长。",
          "教育不可能消除所有差异，也不可能保证每个人实现全部愿望。人仍然需要共同的知识、现实的技能、社会责任，以及去做那些不喜欢但必须做的事的能力。但这些要求，不该让教育退化成一个不断筛选、排序、淘汰人的过程。",
          "我希望好的教育至少有这样一种态度：",
          "学生不理解时，先认真弄清他为什么不理解。",
          "一种教法没用时，继续找别的办法，而不是轻易否定学生。",
          "学生确实不擅长某个领域时，仍然帮他打好必要的基础，也让他有机会找到别的值得投入的方向。",
          "学生有不同于主流标准的兴趣和才能时，不要求他先在某场考试里证明自己，才允许他认真发展。",
          "而当一个人已经能自己选择、学习和创造时，教育应该慢慢退到支持者的位置，不再替他决定人生该往哪里走。",
          "教育真正重要的，也许不是让所有人最后到达同一个地方，而是让一个人慢慢理解世界，发现自己想做什么，并拥有尽可能充分的能力和机会去做到。",
          "一个好的老师，不会因为自己站得更高，就看不起还没走到那里的人。",
          "一个好的教育体系，也不该因为一个人没走到它预设的位置，就认定他没有值得发展的未来。"
        ]
      }
    ]
  },
  "sources": [
    {
      "en": "Newton (1990), Stanford University doctoral dissertation: The rocky road from actions to intentions (the song-tapping study)",
      "zh": "Newton（1990），斯坦福大学博士论文：The rocky road from actions to intentions（“敲歌”实验）",
      "url": "https://www.proquest.com/docview/303855973"
    },
    {
      "en": "Nathan & Petrosino (2003), American Educational Research Journal: Expert blind spot among preservice teachers",
      "zh": "Nathan & Petrosino（2003），《美国教育研究期刊》：Expert blind spot among preservice teachers",
      "url": "https://doi.org/10.3102/00028312040004905"
    },
    {
      "en": "Wang, Wang, Wang, Wind & Gill (2024), Learning and Motivation: a systematic review and meta-analysis of self-determination-theory-based interventions in education",
      "zh": "Wang 等（2024），Learning and Motivation：基于自我决定理论的教育干预：系统综述与元分析",
      "url": "https://doi.org/10.1016/j.lmot.2024.102015"
    },
    {
      "en": "Howard, Slemp & Wang (2025), Personality and Social Psychology Bulletin: need support and need thwarting in student populations, a meta-analysis",
      "zh": "Howard、Slemp & Wang（2025），Personality and Social Psychology Bulletin：学生群体中的需要支持与需要阻碍：元分析",
      "url": "https://doi.org/10.1177/01461672231225364"
    },
    {
      "en": "Bastani et al. (2025), PNAS: Generative AI without guardrails can harm learning",
      "zh": "Bastani 等（2025），PNAS：Generative AI without guardrails can harm learning",
      "url": "https://doi.org/10.1073/pnas.2422633122"
    }
  ]
};
