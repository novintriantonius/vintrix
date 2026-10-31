import { motion, useReducedMotion } from 'motion/react';
import {
  FolderOpen,
  MagnifyingGlass,
  ChatCircleText,
  ShieldCheck,
  Tree,
  Plugs,
} from '@phosphor-icons/react';
import { LogoMark } from '../common';

const features = [
  {
    icon: Tree,
    title: 'Visual Knowledge Graph',
    desc: 'Navigate your codebase as an interactive node graph. See module relationships, call chains, and architecture at a glance.',
    img: `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=interactive%20knowledge%20graph%20canvas%20close%20up%20luminous%20sky%20blue%20nodes%20linked%20by%20thin%20glowing%20cyan%20edges%20deep%20midnight%20navy%20background%20blurred%20code%20labels%20soft%20bloom%20dark%20developer%20ui%20high%20detail&image_size=landscape_4_3`,
    wide: true,
  },
  {
    icon: MagnifyingGlass,
    title: 'Hybrid Search',
    desc: 'BM25 lexical and vector semantic search via XERJ binary. Zero Python runtime required.',
    img: `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=dark%20command%20palette%20search%20overlay%20ranked%20code%20snippet%20results%20highlighted%20matching%20tokens%20sky%20blue%20accent%20bars%20monospaced%20text%20deep%20navy%20background%20crisp%20developer%20tool%20interface%20shallow%20depth%20of%20field&image_size=portrait_4_3`,
    wide: false,
  },
  {
    icon: ChatCircleText,
    title: 'Context-Aware Chat',
    desc: 'Ask questions about any workspace using any OpenAI-compatible model. Works with local Ollama or cloud APIs.',
    img: `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=dark%20ai%20chat%20panel%20about%20software%20architecture%20message%20bubbles%20with%20code%20chips%20and%20file%20references%20subtle%20sky%20blue%20glow%20deep%20navy%20surface%20minimal%20developer%20interface%20soft%20lighting&image_size=portrait_4_3`,
    wide: false,
  },
  {
    icon: FolderOpen,
    title: 'Multi-Source Indexing',
    desc: 'Connect Git repos or SSH servers. Browse remote directories and select paths for indexing across multiple workspaces.',
    img: `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=dark%20file%20explorer%20tree%20showing%20remote%20ssh%20server%20directories%20and%20git%20repository%20branches%20selected%20for%20indexing%20sky%20blue%20checkmarks%20deep%20navy%20panels%20monospaced%20paths%20clean%20developer%20settings%20ui&image_size=landscape_4_3`,
    wide: true,
  },
];

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  const reduce = useReducedMotion();
  const Icon = feature.icon;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-xl overflow-hidden border border-slate-800 bg-[#0d1520] flex flex-col ${feature.wide ? 'md:col-span-2' : 'md:col-span-1'}`}
    >
      <div className="flex-1 overflow-hidden">
        <img
          src={feature.img}
          alt={feature.title}
          className="w-full object-cover h-48 md:h-56"
          loading="lazy"
        />
      </div>
      <div className="p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sky-400">
          <Icon size={18} weight="duotone" />
          <span className="text-xs font-mono text-sky-400/70">{feature.title}</span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
      </div>
    </motion.div>
  );
}

export function FeaturesSection() {
  const reduce = useReducedMotion();
  return (
    <section id="features" className="py-28 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-14 max-w-xl"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-slate-100 tracking-tighter leading-tight mb-4">
          Everything you need to understand any codebase
        </h2>
        <p className="text-slate-400 leading-relaxed">
          One platform to connect repos, explore architecture, search semantically, and chat with context.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <FeatureCard key={f.title} feature={f} index={i} />
        ))}
      </div>
    </section>
  );
}

const steps = [
  {
    num: '01',
    title: 'Create a workspace',
    desc: 'Sign up and get a default workspace. Invite collaborators with role-based access control.',
  },
  {
    num: '02',
    title: 'Connect your sources',
    desc: 'Add Git repositories or SSH servers. Browse remote directories and pick paths to index.',
  },
  {
    num: '03',
    title: 'Explore the graph',
    desc: 'XERJ indexes your codebase with tree-sitter AST analysis. Navigate as a live knowledge graph.',
  },
  {
    num: '04',
    title: 'Ask questions',
    desc: 'Use any OpenAI-compatible model. Context is automatically assembled from the indexed workspace.',
  },
];

export function HowItWorksSection() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="py-28 px-6 bg-[#080d15]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 tracking-tighter leading-tight mb-4">
            From zero to knowledge in minutes
          </h2>
          <p className="text-slate-400 max-w-[48ch] mx-auto leading-relaxed">
            No pipelines to maintain. No embeddings to babysit. Just connect and explore.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <span className="font-mono text-4xl font-bold text-slate-800 select-none">
                {step.num}
              </span>
              <h3 className="mt-2 text-slate-100 font-semibold text-base">{step.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const extras = [
  { icon: ShieldCheck, label: 'AES-256-GCM encryption for all credentials (ISO 27001 A.10)' },
  { icon: Plugs, label: 'Pluggable AI endpoints — OpenAI, Ollama, and any compatible API' },
  { icon: Tree, label: 'Multi-workspace multi-repo with granular RBAC roles' },
  { icon: MagnifyingGlass, label: 'XERJ hybrid search — file:line precision, no Python runtime' },
];

export function OpenSourceSection() {
  const reduce = useReducedMotion();
  return (
    <section id="open-source" className="py-28 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-100 tracking-tighter leading-tight">
            Open source and built for teams who care about security.
          </h2>
          <p className="text-slate-400 leading-relaxed">
            Vintrix is fully open source. Deploy on your own infrastructure. Credentials are encrypted at rest using envelope AES-256-GCM. Nothing leaves your network unless you configure an external AI endpoint.
          </p>
          <ul className="flex flex-col gap-3">
            {extras.map((e) => {
              const Icon = e.icon;
              return (
                <li key={e.label} className="flex items-start gap-3">
                  <Icon size={16} weight="duotone" className="text-sky-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-400">{e.label}</span>
                </li>
              );
            })}
          </ul>
          <a
            href="https://github.com/novintriantonius/vintrix"
            target="_blank"
            rel="noreferrer"
            className="self-start text-sm font-medium text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400/50 px-4 py-2 rounded-lg transition-colors duration-150"
          >
            View on GitHub
          </a>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <img
            src={`https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=self%20hosted%20server%20rack%20in%20a%20dark%20data%20center%20lit%20by%20cool%20sky%20blue%20and%20cyan%20light%20glowing%20network%20status%20leds%20minimal%20cinematic%20wide%20shot%20deep%20navy%20shadows%20professional%20infrastructure%20photography&image_size=landscape_4_3`}
            alt="Secure self-hosted Vintrix deployment"
            className="rounded-xl border border-slate-800 w-full"
            loading="lazy"
          />
        </motion.div>
      </div>
    </section>
  );
}

interface CtaProps {
  onOpenApp?: () => void;
}

export function CtaSection({ onOpenApp }: CtaProps) {
  const reduce = useReducedMotion();
  return (
    <section className="py-28 px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(14,165,233,0.12) 0%, transparent 70%)',
        }}
      />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-2xl mx-auto text-center"
      >
        <h2 className="text-3xl md:text-5xl font-bold text-slate-100 tracking-tighter mb-5 leading-tight">
          Ready to see your codebase differently?
        </h2>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Free to self-host. No vendor lock-in. Start exploring in minutes.
        </p>
        <button
          type="button"
          onClick={onOpenApp}
          className="inline-flex items-center gap-2 text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white px-6 py-3 rounded-lg transition-colors duration-150 active:scale-[0.98]"
        >
          Get started free
        </button>
      </motion.div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-800/60 py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <LogoMark size={18} />
          <span className="font-semibold text-slate-300">vintrix</span>
          <span>-</span>
          <span>Open-source codebase knowledge platform</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-500">
          <a href="https://github.com/novintriantonius/vintrix" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition-colors">GitHub</a>
          <a href="/docs" className="hover:text-slate-300 transition-colors">Docs</a>
          <span className="font-mono text-xs text-slate-700">MIT License</span>
        </div>
      </div>
    </footer>
  );
}
