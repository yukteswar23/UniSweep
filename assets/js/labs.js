// Industry AI labs tracked by UniSweep.
// `openalex` lists the OpenAlex institution IDs used to fetch each lab's recent papers.
// To add a lab: search https://api.openalex.org/institutions?search=NAME and copy the "I..." id.
window.UNISWEEP_LABS = [
  {
    id: "openai", name: "OpenAI", hq: "San Francisco, USA",
    focus: "Frontier large language and multimodal models, reasoning models, alignment and safety research.",
    tags: ["LLMs", "Reasoning", "Multimodal", "Alignment"],
    openalex: ["I4210161460"],
    links: [["Research", "https://openai.com/research"], ["News", "https://openai.com/news"]],
  },
  {
    id: "anthropic", name: "Anthropic", hq: "San Francisco, USA",
    focus: "Frontier LLMs (Claude), interpretability, alignment, and AI safety research.",
    tags: ["LLMs", "Interpretability", "Alignment", "Safety"],
    openalex: ["I4387930290"],
    links: [["Research", "https://www.anthropic.com/research"], ["Transformer Circuits", "https://transformer-circuits.pub"]],
  },
  {
    id: "deepmind", name: "Google DeepMind", hq: "London, UK",
    focus: "General-purpose AI systems, reinforcement learning, AI for science, and the Gemini models.",
    tags: ["RL", "LLMs", "AI for Science", "Robotics"],
    openalex: ["I4210090411"],
    links: [["Research", "https://deepmind.google/research/"], ["Blog", "https://deepmind.google/discover/blog/"]],
  },
  {
    id: "google", name: "Google Research", hq: "Mountain View, USA",
    focus: "Broad ML research: language, vision, efficient models, algorithms, and responsible AI.",
    tags: ["ML", "Vision", "NLP", "Systems"],
    openalex: ["I1291425158"],
    links: [["Research", "https://research.google/"], ["Blog", "https://research.google/blog/"]],
  },
  {
    id: "nvidia", name: "NVIDIA Research", hq: "Santa Clara, USA",
    focus: "Generative AI, computer graphics and vision, robotics and simulation, and accelerated computing for AI.",
    tags: ["Vision", "Graphics", "Robotics", "Generative AI"],
    openalex: ["I4210127875", "I1304085615"],
    links: [["Research", "https://research.nvidia.com/"], ["Publications", "https://research.nvidia.com/publications"]],
  },
  {
    id: "meta", name: "Meta AI (FAIR)", hq: "Menlo Park, USA",
    focus: "Open research on LLMs (Llama), self-supervised learning, computer vision, and embodied AI.",
    tags: ["LLMs", "Vision", "Self-supervised", "Open models"],
    openalex: ["I4210114444"],
    links: [["Research", "https://ai.meta.com/research/"], ["Blog", "https://ai.meta.com/blog/"]],
  },
  {
    id: "microsoft", name: "Microsoft Research", hq: "Redmond, USA",
    focus: "Labs worldwide (incl. India and Asia) working on ML, NLP, systems, and AI for science.",
    tags: ["ML", "NLP", "Systems", "AI for Science"],
    openalex: ["I1290206253", "I4210113369", "I4210164937", "I4210124949"],
    links: [["Research", "https://www.microsoft.com/en-us/research/"], ["MSR India", "https://www.microsoft.com/en-us/research/lab/microsoft-research-india/"]],
  },
  {
    id: "apple", name: "Apple ML Research", hq: "Cupertino, USA",
    focus: "On-device and efficient ML, multimodal models, speech, and privacy-preserving learning.",
    tags: ["Efficient ML", "Multimodal", "Speech", "Privacy"],
    openalex: ["I4210153776"],
    links: [["Research", "https://machinelearning.apple.com/"]],
  },
  {
    id: "amazon", name: "Amazon Science", hq: "Seattle, USA",
    focus: "Applied ML at scale: LLMs, recommendation, speech, robotics, and AWS AI.",
    tags: ["LLMs", "Recommender", "Robotics", "Speech"],
    openalex: ["I1311688040"],
    links: [["Research", "https://www.amazon.science/"]],
  },
  {
    id: "mistral", name: "Mistral AI", hq: "Paris, France",
    focus: "Open-weight and efficient large language models.",
    tags: ["LLMs", "Open models", "Efficiency"],
    openalex: ["I4390039361"],
    links: [["News", "https://mistral.ai/news/"]],
  },
  {
    id: "deepseek", name: "DeepSeek", hq: "Hangzhou, China",
    focus: "Open-weight LLMs, mixture-of-experts, and reasoning models trained with RL.",
    tags: ["LLMs", "MoE", "Reasoning", "RL"],
    openalex: ["I4405257960"],
    links: [["GitHub", "https://github.com/deepseek-ai"]],
  },
  {
    id: "alibaba", name: "Alibaba (Qwen)", hq: "Hangzhou, China",
    focus: "The Qwen family of open LLMs and multimodal models, plus recommendation and e-commerce AI.",
    tags: ["LLMs", "Multimodal", "Open models"],
    openalex: ["I45928872"],
    links: [["Qwen", "https://qwenlm.github.io/"]],
  },
];
