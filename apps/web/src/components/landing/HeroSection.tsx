import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, GitBranch, Graph, SignOut } from '@phosphor-icons/react';
import type { AuthUser } from '../../services/api';

interface NavProps {
  onOpenApp?: () => void;
  onOpenAuth?: () => void;
  user?: AuthUser | null;
  onLogout?: () => void;
}

export function Nav({ onOpenApp, onOpenAuth, user, onLogout }: NavProps) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      initial={reduce ? false : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 inset-x-0 z-50 h-16 flex items-center"
    >
      <div className="w-full max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Graph size={22} weight="fill" className="text-sky-400" />
          <span className="font-semibold text-slate-100 tracking-tight text-sm">vintrix</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <a href="#features" className="hover:text-slate-200 transition-colors duration-150">Features</a>
          <a href="#how" className="hover:text-slate-200 transition-colors duration-150">How it works</a>
          <a href="#open-source" className="hover:text-slate-200 transition-colors duration-150">Open Source</a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 rounded-lg">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 text-[10px] font-bold text-slate-950 flex items-center justify-center shrink-0">
                {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
              <span className="text-xs text-slate-200 max-w-[100px] truncate">{user.displayName || user.email}</span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out"
                  className="text-slate-400 hover:text-rose-400 transition-colors ml-1"
                >
                  <SignOut size={13} weight="bold" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth || onOpenApp}
              className="hidden sm:block text-sm text-slate-400 hover:text-slate-200 transition-colors duration-150"
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={onOpenApp}
            className="text-sm font-medium bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg transition-colors duration-150 flex items-center gap-1.5 active:scale-[0.98]"
          >
            Launch Studio
            <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </div>
    </motion.header>
  );
}

interface HeroProps {
  onOpenApp?: () => void;
}

export function Hero({ onOpenApp }: HeroProps) {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.1, delayChildren: 0.15 },
    },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const itemTransition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <section className="min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(14,165,233,0.15) 0%, transparent 70%)',
        }}
      />

      <motion.div
        variants={reduce ? undefined : container}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="relative z-10 flex flex-col items-center gap-5 max-w-4xl mx-auto"
      >
        <motion.div variants={reduce ? undefined : item} transition={itemTransition}>
          <span className="inline-flex items-center gap-2 text-xs font-mono text-sky-400 border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Open-source knowledge platform
          </span>
        </motion.div>

        <motion.h1
          variants={reduce ? undefined : item}
          transition={itemTransition}
          className="text-4xl md:text-6xl font-bold text-slate-100 tracking-tighter leading-[1.05]"
        >
          Stop reading code blind.
          <br />
          <span className="text-sky-400">Start seeing the big picture.</span>
        </motion.h1>

        <motion.p
          variants={reduce ? undefined : item}
          transition={itemTransition}
          className="text-lg text-slate-400 max-w-[52ch] leading-relaxed"
        >
          Turn any codebase, multi-repo workspace, or remote server into an interactive knowledge graph you can explore, search, and ask questions about.
        </motion.p>

        <motion.div
          variants={reduce ? undefined : item}
          transition={itemTransition}
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <button
            type="button"
            onClick={onOpenApp}
            className="text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white px-5 py-2.5 rounded-lg transition-colors duration-150 flex items-center gap-2 active:scale-[0.98]"
          >
            Get started free
            <ArrowRight size={14} weight="bold" />
          </button>
          <a
            href="https://github.com/novintriantonius/vintrix"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 px-5 py-2.5 rounded-lg transition-colors duration-150 flex items-center gap-2 active:scale-[0.98]"
          >
            <GitBranch size={14} />
            View on GitHub
          </a>
        </motion.div>
      </motion.div>

      {/* Hero visual: graph preview illustration */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mt-16 w-full max-w-5xl mx-auto"
      >
        <div
          className="rounded-xl overflow-hidden border border-slate-800"
          style={{
            background: 'linear-gradient(135deg, #0d1520 0%, #080e17 100%)',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <img
            src={`https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=dark%20mode%20interactive%20code%20graph%20UI%20showing%20interconnected%20nodes%20representing%20modules%20services%20and%20classes%20with%20glowing%20lines%20on%20deep%20dark%20background%20developer%20tool%20aesthetic%20blue%20teal%20accent%20graph%20visualization%20knowledge%20graph%20codebase%20explorer&image_size=landscape_16_9`}
            alt="Vintrix knowledge graph UI"
            className="w-full block"
            loading="eager"
          />
        </div>
        {/* Bottom fade */}
        <div
          className="absolute bottom-0 inset-x-0 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #050a10 0%, transparent 100%)' }}
        />
      </motion.div>
    </section>
  );
}
