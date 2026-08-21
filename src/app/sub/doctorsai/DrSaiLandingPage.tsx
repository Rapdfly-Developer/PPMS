"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Eye,
  Microscope,
  Brain,
  Award,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Share2,
  ChevronDown,
  Stethoscope,
  Clock,
  Calendar,
  ArrowUpRight,
  Zap,
} from "lucide-react";

/* ─── design tokens ────────────────────────────────────────────────────────── */
const TEAL = "#14F1D9";
const PURPLE = "#9D4EDD";
const BG = "#08090C";
const CARD = "#0A0D14";
const BORDER = "rgba(255,255,255,0.08)";

/* ─── section fade-in helper ───────────────────────────────────────────────── */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── stat card ─────────────────────────────────────────────────────────────── */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-6 py-5 rounded-2xl border"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <span
        className="text-3xl font-bold font-serif tracking-tight"
        style={{ color: TEAL }}
      >
        {value}
      </span>
      <span className="text-xs font-medium text-slate-400 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

/* ─── expertise chip ─────────────────────────────────────────────────────────── */
function Chip({
  icon: Icon,
  label,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
      style={{
        background: accent ? `${TEAL}12` : `${PURPLE}10`,
        borderColor: accent ? `${TEAL}40` : `${PURPLE}40`,
        color: accent ? TEAL : PURPLE,
      }}
    >
      <Icon size={14} />
      {label}
    </div>
  );
}

/* ─── service card ───────────────────────────────────────────────────────────── */
function ServiceCard({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  accent?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-4 p-6 rounded-2xl border"
      style={{ background: CARD, borderColor: BORDER }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${accent ?? TEAL}18` }}
      >
        <Icon size={18} style={{ color: accent ?? TEAL }} />
      </div>
      <div>
        <h3 className="font-semibold text-slate-100 mb-1.5">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

/* ─── main page ──────────────────────────────────────────────────────────────── */
export default function DrSaiLandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);

  const [menuOpen, setMenuOpen] = useState(false);

  /* sticky nav highlight */
  const [activeSection, setActiveSection] = useState("hero");
  useEffect(() => {
    const sections = ["hero", "about", "expertise", "contact"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -40% 0px" }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const navLinks = [
    { id: "about", label: "About" },
    { id: "expertise", label: "Expertise" },
    { id: "contact", label: "Contact" },
  ];

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  return (
    <div
      className="min-h-screen font-sans text-slate-100 overflow-x-hidden"
      style={{ background: BG }}
    >
      {/* ── Google Fonts ─────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Space+Mono:wght@400;700&display=swap');
        .font-serif { font-family: 'Playfair Display', Georgia, serif; }
        .font-sans  { font-family: 'Plus Jakarta Sans', Inter, sans-serif; }
        .font-mono  { font-family: 'Space Mono', monospace; }
        ::selection { background: rgba(20,241,217,0.15); color: #6EFCE8; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md"
        style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(8,9,12,0.75)" }}
      >
        <button
          onClick={() => scrollTo("hero")}
          className="font-serif text-lg font-bold tracking-tight"
          style={{ color: TEAL }}
        >
          Dr. Sai
        </button>

        {/* desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="text-sm font-medium transition-colors"
              style={{
                color: activeSection === l.id ? TEAL : "rgb(148,163,184)",
              }}
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => scrollTo("contact")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: TEAL, color: BG }}
          >
            Book Appointment <ArrowUpRight size={13} />
          </button>
        </div>

        {/* mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-5 h-0.5 rounded transition-all"
              style={{ background: menuOpen ? TEAL : "rgb(148,163,184)" }}
            />
          ))}
        </button>
      </nav>

      {/* mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[60px] inset-x-0 z-40 flex flex-col gap-1 p-4 backdrop-blur-xl md:hidden"
            style={{ background: "rgba(10,13,20,0.97)", borderBottom: `1px solid ${BORDER}` }}
          >
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{
                  color: activeSection === l.id ? TEAL : "rgb(148,163,184)",
                  background: activeSection === l.id ? `${TEAL}10` : "transparent",
                }}
              >
                {l.label}
              </button>
            ))}
            <button
              onClick={() => scrollTo("contact")}
              className="mt-2 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: TEAL, color: BG }}
            >
              Book Appointment
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-12 overflow-hidden"
      >
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full opacity-[0.07] blur-[120px]"
          style={{ background: TEAL }}
        />
        <div
          className="pointer-events-none absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
          style={{ background: PURPLE }}
        />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative z-10 flex flex-col items-center text-center gap-6 max-w-3xl"
        >
          {/* handle badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-medium"
            style={{ borderColor: `${TEAL}40`, color: TEAL, background: `${TEAL}10` }}
          >
            <Zap size={11} />
            @vitreous_void
          </motion.div>

          {/* portrait */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden"
              style={{ boxShadow: `0 0 0 2px ${TEAL}, 0 0 0 6px ${BG}, 0 0 40px ${TEAL}30` }}
            >
              <Image
                src="/doctors/dr-sai-portrait.jpeg"
                alt="Dr. Sai Dharshan"
                width={160}
                height={160}
                className="w-full h-full object-cover object-top"
                unoptimized
                priority
              />
            </div>
            {/* online indicator */}
            <span
              className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2"
              style={{ background: "#22c55e", borderColor: BG }}
            />
          </motion.div>

          {/* name & title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.65 }}
            className="flex flex-col gap-2"
          >
            <h1 className="text-4xl md:text-6xl font-serif font-bold tracking-tight leading-tight">
              Dr. <span style={{ color: TEAL }}>Sai</span> Dharshan
            </h1>
            <p className="text-base md:text-lg text-slate-400 font-medium">
              Vitreoretinal Surgeon &amp; Ophthalmic Innovator
            </p>
          </motion.div>

          {/* expertise chips */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-wrap justify-center gap-2"
          >
            <Chip icon={Eye} label="Vitreoretinal Surgery" accent />
            <Chip icon={Microscope} label="Micro-vascular Diagnostics" />
            <Chip icon={Brain} label="AI-Assisted Care" accent />
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <button
              onClick={() => scrollTo("contact")}
              className="px-6 py-3 rounded-full font-semibold text-sm transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
              style={{ background: TEAL, color: BG, boxShadow: `0 0 24px ${TEAL}40` }}
            >
              Book Consultation
            </button>
            <button
              onClick={() => scrollTo("about")}
              className="px-6 py-3 rounded-full font-semibold text-sm border transition-all hover:border-slate-500"
              style={{ borderColor: BORDER, color: "rgb(148,163,184)" }}
            >
              Learn More
            </button>
          </motion.div>
        </motion.div>

        {/* scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
        >
          <span className="text-xs text-slate-600 font-mono tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown size={18} className="text-slate-600" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────────────────────── */}
      <section className="px-6 py-6">
        <FadeUp>
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat value="12+" label="Years of Experience" />
            <Stat value="3000+" label="Surgeries Performed" />
            <Stat value="98%" label="Patient Satisfaction" />
            <Stat value="5★" label="Peer Rating" />
          </div>
        </FadeUp>
      </section>

      {/* ── ABOUT ──────────────────────────────────────────────────────────────── */}
      <section id="about" className="px-6 py-20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <FadeUp>
            <div
              className="rounded-3xl overflow-hidden aspect-[4/5] relative"
              style={{ border: `1px solid ${BORDER}` }}
            >
              <Image
                src="/doctors/dr-sai-portrait.jpeg"
                alt="Dr. Sai Dharshan"
                fill
                unoptimized
                className="object-cover object-top"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* subtle teal gradient overlay at the bottom */}
              <div
                className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
                style={{ background: `linear-gradient(to top, ${BG}CC, transparent)` }}
              />
            </div>
          </FadeUp>
          <div className="flex flex-col gap-6">
            <FadeUp delay={0.1}>
              <span className="font-mono text-xs tracking-widest uppercase" style={{ color: TEAL }}>
                About
              </span>
            </FadeUp>
            <FadeUp delay={0.2}>
              <h2 className="text-3xl md:text-4xl font-serif font-bold leading-tight">
                Precision care for the{" "}
                <em style={{ color: TEAL }}>eyes that matter</em>
              </h2>
            </FadeUp>
            <FadeUp delay={0.3}>
              <p className="text-slate-400 leading-relaxed">
                Dr. Sai Dharshan is a fellowship-trained Vitreoretinal Specialist with over a decade of
                experience in complex posterior segment surgery. Combining microsurgical precision with
                cutting-edge AI diagnostics, he delivers personalised, evidence-based care for conditions
                ranging from diabetic retinopathy to complex retinal detachments.
              </p>
            </FadeUp>
            <FadeUp delay={0.4}>
              <p className="text-slate-400 leading-relaxed">
                An advocate for technology-driven ophthalmology, Dr. Sai actively collaborates on AI
                research initiatives to improve early detection and surgical outcomes.
              </p>
            </FadeUp>
            <FadeUp delay={0.5}>
              <div className="flex flex-wrap gap-2">
                <Chip icon={Award} label="Fellowship Trained" accent />
                <Chip icon={Stethoscope} label="DOMS · DNB · FRCS" />
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── EXPERTISE ──────────────────────────────────────────────────────────── */}
      <section id="expertise" className="px-6 py-20">
        <div className="max-w-4xl mx-auto flex flex-col gap-12">
          <FadeUp className="text-center">
            <span className="font-mono text-xs tracking-widest uppercase block mb-3" style={{ color: TEAL }}>
              Expertise
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold">
              Conditions &amp; Procedures
            </h2>
          </FadeUp>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Eye,
                title: "Retinal Detachment Repair",
                desc: "Vitrectomy, scleral buckle, and pneumatic retinopexy for acute and chronic detachments.",
                accent: TEAL,
              },
              {
                icon: Microscope,
                title: "Diabetic Vitrectomy",
                desc: "Surgical management of vitreous haemorrhage and tractional detachment secondary to DR.",
                accent: TEAL,
              },
              {
                icon: Brain,
                title: "Macular Surgery",
                desc: "ERM peeling, macular hole repair, and subretinal membrane extraction.",
                accent: PURPLE,
              },
              {
                icon: Zap,
                title: "Intravitreal Injections",
                desc: "Anti-VEGF therapy for wet AMD, DME, and BRVO/CRVO.",
                accent: TEAL,
              },
              {
                icon: Award,
                title: "Ocular Trauma",
                desc: "Primary repair of open-globe injuries with posterior segment reconstruction.",
                accent: PURPLE,
              },
              {
                icon: Stethoscope,
                title: "AI-Augmented Diagnostics",
                desc: "OCT and fundus photography interpreted with AI assistance for early lesion detection.",
                accent: PURPLE,
              },
            ].map((s, i) => (
              <FadeUp key={s.title} delay={i * 0.07}>
                <ServiceCard {...s} />
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ──────────────────────────────────────────────────────────────── */}
      <section id="contact" className="px-6 py-20">
        <div className="max-w-2xl mx-auto flex flex-col gap-10">
          <FadeUp className="text-center">
            <span className="font-mono text-xs tracking-widest uppercase block mb-3" style={{ color: TEAL }}>
              Contact
            </span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold">Book a Consultation</h2>
            <p className="mt-3 text-slate-400">
              Reach out through any of the channels below. We aim to respond within one business day.
            </p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div
              className="flex flex-col gap-3 rounded-3xl p-6 border"
              style={{ background: CARD, borderColor: BORDER }}
            >
              {[
                {
                  icon: MapPin,
                  label: "Location",
                  value: "Chennai, Tamil Nadu, India",
                },
                {
                  icon: Clock,
                  label: "Clinic Hours",
                  value: "Mon – Sat · 9:00 AM – 5:00 PM",
                },
                {
                  icon: Calendar,
                  label: "Appointments",
                  value: "By prior appointment only",
                },
                {
                  icon: Phone,
                  label: "Phone",
                  value: "+91 98400 00000",
                },
                {
                  icon: Mail,
                  label: "Email",
                  value: "drsai@ppmsai.com",
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4 py-3 border-b last:border-0" style={{ borderColor: BORDER }}>
                  <div
                    className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
                    style={{ background: `${TEAL}15` }}
                  >
                    <Icon size={15} style={{ color: TEAL }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                    <p className="text-sm text-slate-200 mt-0.5">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>

          <FadeUp delay={0.2} className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://twitter.com/vitreous_void"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border text-sm font-semibold transition-all hover:border-slate-500"
              style={{ borderColor: BORDER, color: "rgb(148,163,184)" }}
            >
              <ExternalLink size={16} /> @vitreous_void
            </a>
            <a
              href="https://instagram.com/vitreous_void"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full border text-sm font-semibold transition-all hover:border-slate-500"
              style={{ borderColor: BORDER, color: "rgb(148,163,184)" }}
            >
              <Share2 size={16} /> Instagram
            </a>
          </FadeUp>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────────── */}
      <footer
        className="px-6 py-8 text-center"
        style={{ borderTop: `1px solid ${BORDER}` }}
      >
        <p className="text-xs text-slate-600 font-mono">
          © {new Date().getFullYear()} Dr. Sai Dharshan · All rights reserved ·{" "}
          <span style={{ color: TEAL }}>ppmsai.com</span>
        </p>
      </footer>
    </div>
  );
}
