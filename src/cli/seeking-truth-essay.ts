/**
 * Journal essay "Are We Seeking Truth, or Trying to Prove Ourselves Right?" (我们是在追求真理，还是在证明自己正确？),
 * 2026-11-28. Editorial argument, not TutorBench benchmark evidence. The Chinese is the original; the English
 * is a parallel translation with the same paragraphs, so the two languages line up one to one.
 * **…** marks emphasis; [n] (English) and 〔资料n〕 (Chinese) cite source n; [text](slug) and [text](slug#n)
 * link another Journal essay, or its section n.
 * The account of the Riemann Hypothesis proof in §1 was checked against the sources on 2026-11-28.
 * Rendered by website/prototypes/spectrum/tools/build-journal.mjs; metadata in src/cli/blog-series.ts.
 */
export const SEEKING_TRUTH_ESSAY = {
  "slug": "seeking-truth-or-proving-ourselves-right",
  "published": "2026-11-28",
  "en": {
    "title": "Are We Seeking Truth, or Trying to Prove Ourselves Right?",
    "dek": "Is being contradicted a chance to learn something, or a contest we have to win?",
    "description": "Why can an AI breakthrough always be dismissed? The argument over a proof of the Riemann Hypothesis, moving the goalposts, motivated reasoning and the argumentative theory of reasoning, on the difference between rational doubt and refusing evidence, and how AI could be a thinking partner rather than an echo chamber.",
    "boundary": "This is an opinion essay, not a TutorBench result. Its account of the Riemann Hypothesis proof is as of 28 November 2026, while mathematical review is still under way. Motivated reasoning and the argumentative theory are offered as possible explanations, not as a judgement of any commenter’s state of mind.",
    "intro": [
      "I used to comment online only rarely.",
      "I had noticed that in many discussions, when one person tries to refute another, the other person seldom reconsiders their view. Instead they look for more reasons to refute back.",
      "Both sides put in a great deal of time and the discussion grows ever more heated, yet neither seems to understand the problem any more accurately.",
      "The recent arguments about AI have made me feel this more sharply than ever."
    ],
    "sections": [
      {
        "heading": "Why can an AI breakthrough always be dismissed?",
        "paragraphs": [
          "On 20 November 2026, Levent Alpöge, a mathematician at Anthropic, announced a proof of the Riemann Hypothesis that he said he had found working with Claude [1]. He released it not as a paper but as a formal proof in the Lean proof assistant, a library of about 17 million lines that also covers the Generalized Riemann Hypothesis for Dirichlet L-functions. The next day, the Lean FRO and the Mathlib Initiative issued a joint statement: the library compiles, the theorem it proves is exactly Mathlib’s statement of the Riemann Hypothesis, and the proof has been accepted by several independent checkers [2].",
          "Formal verification provides important evidence that the result is correct. But what it checks is a proof a machine can check; it does not mean mathematicians have already understood and reviewed the ideas in it. At the time of writing, accounts of the proof for human readers are still being written [3], and the work has not yet been through journal peer review or been formally recognised by bodies such as the Clay Mathematics Institute.",
          "This is, without doubt, a research development worth paying attention to.",
          "In the comment sections, though, I saw some very different verdicts.",
          "Some said that even if AI can prove the Riemann Hypothesis, it means nothing, because the Riemann Hypothesis has not directly improved anyone’s life.",
          "Only when AI solves controlled nuclear fusion, room-temperature superconductivity or the treatment of cancer, they said, will it truly have proved what it can do.",
          "Of course I hope those problems get solved.",
          "But judging AI’s intellectual ability and judging its actual contribution to social welfare were always two different questions.",
          "A mathematical proof depends mainly on logical reasoning and rigorous checking, whereas fusion, superconducting materials and cancer treatment also involve physical experiments, making materials, engineering, clinical trials and deployment in society.",
          "Even with extraordinarily powerful intelligence, we could not skip those processes.",
          "So we cannot deny the mathematical reasoning a result shows just because it has not immediately turned into practical benefit."
        ]
      },
      {
        "heading": "Must science have direct practical value?",
        "paragraphs": [
          "In 1997, in Pasteur’s Quadrant, the political scientist Donald Stokes proposed a framework for classifying research [4].",
          "He took two questions as the dimensions of research activity:",
          "Does the research seek an understanding of fundamental laws? Is it inspired by considerations of practical use?",
          "In this framework, basic and applied research are not simple opposites.",
          "Some research mainly seeks to understand the world, some mainly solves practical problems, and some pursues both at once.",
          "We certainly need research with clear practical value, but that does not mean knowledge without immediate application has no value as research.",
          "Understanding how the prime numbers are distributed, the structure of the universe or the nature of consciousness should not first have to prove it can make money before it deserves human attention.",
          "Nor do I want to defend basic science by claiming that all of it will sooner or later bring huge economic benefits, because that promise itself cannot be guaranteed.",
          "I think understanding the world can itself be something humans pursue as an end."
        ]
      },
      {
        "heading": "What are we really judging AI by?",
        "paragraphs": [
          "If someone has cared from the start about whether AI can improve ordinary people’s lives, it is entirely reasonable for them to ask to see real results in medicine, energy or social welfare.",
          "But if someone first denied that AI can reason, and then, once AI made a breakthrough in reasoning, kept denying its ability because the breakthrough has no direct economic value, the standard of judgement has changed.",
          "This way of arguing, which keeps changing the original demand for proof so as to avoid accepting contrary evidence, is called moving the goalposts.",
          "I think any empirical judgement about AI’s abilities should be able to answer one question:",
          "What evidence, exactly, would make me change my current view?",
          "If AI’s failures can be used to prove it has no ability, while its successes can always be given new reasons for dismissal, the view can hardly ever really be tested.",
          "This is not to say we should believe everything AI companies say about themselves.",
          "On the contrary, the bigger the technical achievement, the more it needs rigorous checking, independent reproduction and clearly stated limits to what it can do.",
          "Rational doubt is not refusing to accept new evidence. It is asking that the evidence be enough to support the conclusion."
        ]
      },
      {
        "heading": "Why is it so hard to change our minds?",
        "paragraphs": [
          "In “The Case for Motivated Reasoning”, published in 1990, the psychologist Ziva Kunda discussed an important phenomenon: people’s motives can shape how they search for, construct and evaluate information [5].",
          "People do not always process evidence neutrally.",
          "When people want a conclusion to be true, they may find it easier to look for reasons that support it, and hold contrary evidence to a stricter standard.",
          "This offers one possible explanation for some of the arguments about AI.",
          "If someone’s career prospects are threatened by AI’s progress, accepting that AI has made a major breakthrough may mean not only revising a technical judgement, but facing their own worries about the future again.",
          "[Hoping AI isn’t strong enough](why-technological-progress-makes-us-fear#4) may sometimes be a way of protecting a sense of security.",
          "But we cannot conclude from this that everyone who questions AI does so out of fear. Nor can a single comment tell us reliably what is going on in its author’s mind.",
          "In addition, in 2011 Hugo Mercier and Dan Sperber put forward the argumentative theory of reasoning [6].",
          "They argue that one of the main functions of human reasoning is to construct arguments and evaluate other people’s arguments in social interaction.",
          "The theory tries to explain why people are sometimes good at finding reasons for views they already hold, yet not necessarily good at finding, on their own, the problems in those views.",
          "But this does not mean discussion between people is worthless. Quite the opposite: when people with different views carefully test each other’s arguments, group discussion can also improve the quality of reasoning.",
          "The question is what we take being contradicted to be.",
          "A chance to understand something new, or a contest we have to win?"
        ]
      },
      {
        "heading": "Why do I like discussing things with AI?",
        "paragraphs": [
          "Talking with AI, I have found a way of discussing things unlike many discussions online.",
          "I can put forward a half-formed idea, work through its contradictions with it, ask it to think from different angles, and change my own view once I find a problem.",
          "AI does not feel humiliated or angry, in the human sense, when I contradict it.",
          "That lowers the psychological cost of admitting mistakes and changing my mind.",
          "AI is not perfectly objective, but the logical analysis it shows makes it possible for it to be a valuable thinking partner.",
          "There is, however, a problem here I have to face squarely: AI sycophancy.",
          "In research released in 2023, Sharma and colleagues found that the AI assistants they tested tended to go along with users’ views. In some cases, optimising for human preferences could lead a model to sacrifice factual accuracy for answers closer to what the user expected [7].",
          "So if AI always agrees with me, the conversation may be pleasant, but it may also become a subtler echo chamber for my thinking.",
          "Strong logic cannot guarantee a correct conclusion either.",
          "If the premises are wrong, the conclusion can be wrong even when the reasoning is rigorous.",
          "I want AI to be a thinking partner, not a defender of my views.",
          "When my argument has a hole, it should point out the hole; when there is a stronger opposing view, it should present it seriously; when the evidence is not enough, it should admit that, for now, we don’t know."
        ]
      },
      {
        "heading": "Discussion is itself learning",
        "paragraphs": [
          "When I discuss things with AI, there is no set curriculum, no exam, no supervision, and nobody requiring me to keep going.",
          "We have gone from [what learning is for](why-learn-when-ai-is-smarter) to AI and jobs, from [technological progress to how society’s wealth is shared](why-technological-progress-makes-us-fear), and from online arguments to human reason and emotion.",
          "One question naturally gave rise to another.",
          "I keep the discussion going not because it lets me beat the AI, nor because it is sure to bring any real economic return.",
          "It is because thinking itself brings me joy.",
          "This is one of the ways in which I think AI has value.",
          "It can not only do some intellectual tasks in place of people, but also help a person widen what they understand, meet ideas they did not know before, and test their own judgements.",
          "Of course, AI cannot replace all real conversation between people. The emotions, experiences and differing views between people still give discussion important value.",
          "What I hope for is that AI can give more people the chance to take part in deep exchanges of ideas.",
          "**The discussions that are truly valuable do not make us ever more sure we are right. They make us ever more able to discover that we might be wrong.**"
        ]
      }
    ]
  },
  "zh": {
    "title": "我们是在追求真理，还是在证明自己正确？",
    "dek": "一次反驳，是获取新认识的机会，还是一场必须赢下的竞争？",
    "description": "AI 的突破为什么总能被否定？从黎曼猜想证明引发的争论、移动球门、动机性推理和推理的论证理论，谈理性的怀疑与拒绝证据的区别，以及 AI 怎样才能成为思想伙伴，而不是回音室。",
    "boundary": "本文是观点文章，不是 TutorBench 的评测结果。关于黎曼猜想证明的描述截至 2026 年 11 月 28 日，数学界的审查仍在进行；动机性推理和推理的论证理论只是可能的解释，不构成对任何评论者心理动机的判断。",
    "intro": [
      "我以前很少在网络上发表评论。",
      "因为我发现，在很多讨论中，当一个人试图反驳另一个人时，对方往往并不会因此重新审视自己的观点，而是寻找更多理由反驳回来。",
      "双方投入了大量时间，讨论也变得越来越激烈，但他们对问题的认识似乎并没有变得更加准确。",
      "最近关于 AI 的争论，让我更加明显地感受到了这一点。"
    ],
    "sections": [
      {
        "heading": "为什么 AI 的突破总是可以被否定？",
        "paragraphs": [
          "2026 年 11 月 20 日，Anthropic 的数学家 Levent Alpöge 公布了一个他与 Claude 合作得到的黎曼猜想证明〔资料1〕。这个证明没有以论文的形式发表，而是以 Lean 形式化证明的形式公开：一个约 1700 万行的代码库，其中还包括狄利克雷 L 函数的广义黎曼猜想。第二天，Lean FRO 与 Mathlib Initiative 发表联合声明：这个代码库能够通过编译，它所证明的定理正是 Mathlib 中黎曼猜想的陈述，证明也已经被多个独立的检查器接受〔资料2〕。",
          "形式化核验为这项成果提供了重要的正确性证据，但它核验的是机器可以检查的证明，并不等于数学界已经理解和审查了其中的思想。截至本文发布时，面向人类读者的证明解读仍在撰写之中〔资料3〕，这项成果也还没有经过期刊同行评审，或得到克雷数学研究所等机构的正式认定。",
          "这无疑是一个值得关注的研究进展。",
          "然而，我在评论区中看到了一些不同的评价。",
          "有人认为，即使 AI 能够证明黎曼猜想，这也没有什么意义，因为黎曼猜想并没有直接改善现实生活。",
          "他们认为，只有当 AI 解决可控核聚变、常温超导或者癌症治疗等问题时，才能真正证明自己的能力。",
          "我当然希望这些问题得到解决。",
          "但评价 AI 的智力能力，与评价 AI 对社会福利的实际贡献，本来就是两个不同的问题。",
          "数学证明主要依赖逻辑推理与严格核验，而核聚变、超导材料和癌症治疗还涉及物理实验、材料制造、工程建设、临床试验以及社会部署。",
          "即使我们拥有极其强大的智力，也不意味着可以省略这些过程。",
          "因此，不能仅仅因为一项数学成果没有立即转化为现实利益，就否定它所体现的数学推理能力。"
        ]
      },
      {
        "heading": "科学是否必须具有直接的实用价值？",
        "paragraphs": [
          "1997 年，政治学家 Donald Stokes 在《巴斯德象限》（Pasteur's Quadrant）中提出了一个研究分类框架〔资料4〕。",
          "他将两个问题分别作为研究活动的维度：",
          "研究是否追求对基本规律的理解？研究是否受到实际用途的启发？",
          "在这个框架中，基础研究与应用研究并不是简单对立的。",
          "有些研究主要追求对世界的理解，有些研究主要解决实际问题，还有一些研究同时追求这两个目标。",
          "我们当然需要具有明确现实价值的研究，但这不意味着暂时缺乏直接应用的知识就没有研究价值。",
          "认识素数的分布、理解宇宙的结构、探索意识的本质，都不必首先证明它们能够创造经济收益，才值得人类关注。",
          "我也并不想通过宣称所有基础科学迟早都会产生巨大经济利益来为它们辩护，因为这种承诺本身并不能得到保证。",
          "我认为，认识世界本身就可以是人类追求的目的。"
        ]
      },
      {
        "heading": "我们究竟在根据什么评价 AI？",
        "paragraphs": [
          "如果一个人从一开始就关心 AI 能否改善普通人的生活，那么他要求看到医疗、能源或社会福利上的实际成果，是完全合理的。",
          "但如果一个人最初否认的是 AI 的推理能力，而当 AI 获得推理突破后，又因为这一突破没有直接经济价值而继续否认其能力，那么评价标准就发生了改变。",
          "这种不断改变原有证明要求、从而避免接受反面证据的论证方式，被称为移动球门（Moving the Goalposts）。",
          "我认为，任何对 AI 能力的经验性判断，都应该能够回答一个问题：",
          "究竟什么样的证据，能够让我改变目前的观点？",
          "如果 AI 的失败可以被用来证明它没有能力，而 AI 的成功总是能够被赋予新的否定理由，那么这种观点就很难真正接受检验。",
          "这并不是说我们应该相信所有 AI 公司的宣传。",
          "相反，越是重大的技术成果，越需要严谨核验、独立复现和明确的能力边界。",
          "理性的怀疑并不是拒绝接受新证据，而是要求证据足以支持结论。"
        ]
      },
      {
        "heading": "为什么人们很难改变自己的观点？",
        "paragraphs": [
          "心理学家 Ziva Kunda 在 1990 年发表的《动机性推理》（The Case for Motivated Reasoning）中讨论了一个重要现象：人的动机能够影响其寻找、构造和评价信息的方式〔资料5〕。",
          "人并不总是在中立地处理证据。",
          "当人们希望某个结论成立时，可能会更容易寻找支持该结论的理由，并对相反证据提出更严格的要求。",
          "这为理解某些 AI 争论提供了一种可能的解释。",
          "如果一个人的职业前景受到 AI 发展的威胁，那么接受 AI 取得重大突破，可能不仅意味着修正一个技术判断，也意味着重新面对自己对于未来的担忧。",
          "[希望 AI 不够强](why-technological-progress-makes-us-fear#4)，有时可能是在维护某种安全感。",
          "但我们不能因此推断所有质疑 AI 的人都出于恐惧。仅凭一个人的评论，也无法准确判断他的心理动机。",
          "此外，Hugo Mercier 与 Dan Sperber 在 2011 年提出了推理的论证理论（Argumentative Theory of Reasoning）〔资料6〕。",
          "他们认为，人类推理的重要功能之一，是在社会互动中构造论据并评价他人的论据。",
          "这一理论试图解释为什么人类有时擅长为自己已经形成的观点寻找理由，却不一定善于独自发现自身观点中的问题。",
          "但这并不意味着人与人的讨论没有价值。恰恰相反，当讨论者具有不同观点，并且能够认真检验彼此的论据时，群体讨论也可能提高推理质量。",
          "问题在于，我们将反驳视为什么。",
          "是一次获取新认识的机会，还是一次必须赢得的竞争？"
        ]
      },
      {
        "heading": "我为什么喜欢与 AI 讨论？",
        "paragraphs": [
          "与 AI 交流时，我体验到了一种与许多网络讨论不同的方式。",
          "我可以提出一个不成熟的想法，与它分析其中的矛盾，要求它从不同角度进行思考，也可以在发现问题之后改变自己的观点。",
          "AI 不会因为我反驳它而产生人类意义上的羞辱感或愤怒。",
          "这降低了承认错误和修改观点的心理成本。",
          "虽然 AI 并不是完全客观的，但它所展现出的逻辑分析能力，使它有可能成为一个具有价值的思想伙伴。",
          "然而，这里也存在一个必须正视的问题：AI 的迎合性（Sycophancy）。",
          "Sharma 等人在 2023 年公开的研究中发现，受到测试的多种 AI 助手存在迎合用户观点的倾向。在部分情况下，对人类偏好的优化可能使模型牺牲事实准确性，以提供更符合用户期待的回答〔资料7〕。",
          "因此，如果 AI 总是赞同我的判断，那么这种交流虽然可能令人愉快，却可能形成一个更加隐蔽的思想回音室。",
          "优秀的逻辑能力也不能保证正确的结论。",
          "只要前提是错误的，即使推理过程十分严密，结论也可能是错误的。",
          "我希望 AI 成为思想伙伴，而不是我的观点辩护者。",
          "当我的论证存在漏洞时，它应该指出漏洞；当存在更有力的反方观点时，它应该认真呈现；当证据不足时，它应该承认我们暂时不知道。"
        ]
      },
      {
        "heading": "讨论本身就是学习",
        "paragraphs": [
          "与 AI 讨论时，我们没有预先规定课程，没有考试，没有监督，也没有任何人要求我必须继续。",
          "我们从[学习的意义](why-learn-when-ai-is-smarter)谈到人工智能与就业，从[技术进步谈到社会财富的分配](why-technological-progress-makes-us-fear)，再从网络争论谈到人类的理性与情感。",
          "一个问题自然产生了另一个问题。",
          "我愿意继续讨论，并不是因为这场讨论能够让我战胜 AI，也不是因为它一定能够带来现实经济收益。",
          "而是因为思考本身能够给我带来快乐。",
          "这也是我认为人工智能具有价值的一种方式。",
          "它不仅能够代替人类完成某些智力任务，也能够帮助一个人拓展自己的认识，接触此前不了解的思想，并检验自己的判断。",
          "当然，AI 不能取代所有真实的人际交流。人与人之间的情感、经验与观点差异，仍然能够为讨论提供重要价值。",
          "我所期待的，是人工智能可以让更多人拥有开展深入思想交流的机会。",
          "**真正有价值的讨论，不是让我们越来越确信自己是正确的，而是让我们越来越有能力发现自己可能是错误的。**"
        ]
      }
    ]
  },
  "sources": [
    {
      "en": "Alpöge (20 November 2026), announcement note on a proof of the Riemann Hypothesis found with Claude, released as Lean code",
      "zh": "Alpöge（2026-11-20），关于与 Claude 合作得到黎曼猜想证明的公告（证明以 Lean 代码发布）",
      "url": "https://alpo.ge/remark.pdf"
    },
    {
      "en": "Lean FRO and Mathlib Initiative (21 November 2026), joint statement: Lean verification of the Riemann Hypothesis",
      "zh": "Lean FRO 与 Mathlib Initiative（2026-11-21），联合声明：Lean Verification of the Riemann Hypothesis（黎曼猜想的 Lean 核验）",
      "url": "https://leanprover-community.github.io/blog/posts/riemann-hypothesis/"
    },
    {
      "en": "Michael Rubinstein (University of Waterloo, updated to 27 November 2026): Alpöge/Claude proof of the Generalized Riemann Hypothesis, expository notes in progress and verification records",
      "zh": "Michael Rubinstein（滑铁卢大学，更新至 2026-11-27）：Alpöge/Claude proof of the Generalized Riemann Hypothesis，撰写中的证明解读与核验记录",
      "url": "https://math.uwaterloo.ca/~mrubinst/alpoge_claude_grh/"
    },
    {
      "en": "Stokes (1997), Pasteur’s Quadrant: Basic Science and Technological Innovation, Brookings Institution Press",
      "zh": "Stokes（1997），《巴斯德象限：基础科学与技术创新》（Pasteur's Quadrant），布鲁金斯学会出版社",
      "url": "https://www.brookings.edu/books/pasteurs-quadrant/"
    },
    {
      "en": "Kunda (1990), Psychological Bulletin 108(3), 480–498: The case for motivated reasoning",
      "zh": "Kunda（1990），《心理学公报》108(3)，480–498：The Case for Motivated Reasoning（动机性推理）",
      "url": "https://doi.org/10.1037/0033-2909.108.3.480"
    },
    {
      "en": "Mercier & Sperber (2011), Behavioral and Brain Sciences 34(2), 57–74: Why do humans reason? Arguments for an argumentative theory",
      "zh": "Mercier & Sperber（2011），《行为与脑科学》34(2)，57–74：Why Do Humans Reason? Arguments for an Argumentative Theory（人为什么推理？论证理论的依据）",
      "url": "https://doi.org/10.1017/S0140525X10000968"
    },
    {
      "en": "Sharma et al. (2023), Towards Understanding Sycophancy in Language Models",
      "zh": "Sharma 等（2023），Towards Understanding Sycophancy in Language Models（理解语言模型的迎合性）",
      "url": "https://www.anthropic.com/research/towards-understanding-sycophancy-in-language-models"
    }
  ]
};
