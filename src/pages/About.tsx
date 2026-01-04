// src/pages/AboutUs.tsx
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ThreeJsBackdrop from "../components/ThreeJsBackdrop";
import {
  ShieldCheck,
  ScanSearch,
  Cpu,
  Users,
  Rocket,
  BadgeCheck,
} from "lucide-react";

import aboutImg from "../assets/normal/about1.jpg";
import vectorImg from "../assets/normal/about3.avif";
import bgImg from "../assets/img/hero_bg_2_1.jpg";
import shape1 from "../assets/img/shape_1.png";
import { container, fadeUp } from "@/lib/motion";



const AboutUs: React.FC = () => {
  return (
    <div className="text-slate-800">
      {/* ===== Hero with breadcrumb (matches Contact) ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={bgImg}
            alt="Abstract security background"
            className="h-[380px] w-full object-cover md:h-[460px]"
          />
          <div className="absolute inset-0">
            <ThreeJsBackdrop modelPath="/models/network.glb" />
          </div>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-0 bottom-[-100px] h-[200px] bg-gradient-to-b from-transparent to-white" />
        </div>

        <div className="relative z-10">
          <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:pb-24 md:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-3xl text-center text-white"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/20">
                Get to know us
              </span>
              <h1 className="mt-3 text-4xl font-bold md:text-5xl">
                About <span className="text-blue-300">Audit Dapps</span>
              </h1>

              <nav aria-label="Breadcrumb" className="mt-4 flex justify-center">
                <ol className="inline-flex items-center space-x-2 text-white/80">
                  <li>
                    <Link to="/" className="transition hover:text-white hover:underline">
                      Home
                    </Link>
                  </li>
                  <li className="flex items-center">
                    <svg className="mx-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium" aria-current="page">
                      About Us
                    </span>
                  </li>
                </ol>
              </nav>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===== Story / Mission ===== */}
      <section id="about-sec" className="bg-white py-16 md:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 lg:flex-row">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45 }}
            className="relative w-full lg:w-1/2"
          >
            <div className="absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-tr from-indigo-100 to-sky-100 blur-2xl" />
            <img
              src={aboutImg as string}
              alt="Audit Dapps team collaborating"
              className="w-full rounded-3xl border border-slate-200 shadow-xl"
            />
          </motion.div>

          {/* Full paragraphs restored */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="w-full text-center lg:w-1/2 lg:text-left"
          >
            <span className="text-sm font-medium uppercase tracking-wide text-blue-700">
              More About Us
            </span>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">
              Empower Your Security Journey
            </h2>

            <p className="mt-3 leading-relaxed text-slate-700">
              Welcome to AuditDApps, your dedicated partner in navigating the ever-evolving realm
              of decentralized applications (DApps). Our commitment extends beyond simplifying the
              complexities of DApp security; we provide a proactive, user-centric approach.
              Whether you&apos;re an experienced developer or taking your first steps into the
              decentralized landscape, AuditDApps is meticulously crafted to ensure a seamless,
              secure, and successful journey. With us, your DApp security isn&apos;t just a priority—
              it&apos;s a personalized experience tailored to empower and elevate your digital ambitions.
            </p>

            <p className="mt-3 leading-relaxed text-slate-700">
              AuditDApps emerges as the epitome of trust and innovation in securing DApps. Our
              services streamline the intricate process of fortifying DApps, presenting a proactive
              and user-friendly paradigm. Tailored for both seasoned developers and newcomers,
              AuditDApps orchestrates a journey that is not only secure but also impactful.
              Whether you seek to enhance existing projects or embark on new ventures, AuditDApps
              stands as the beacon for secure, successful, and seamless DApp development.
            </p>

            {/* Value bullets */}
            <motion.ul
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {[
                {
                  icon: <ShieldCheck className="h-5 w-5 text-indigo-600" />,
                  text: "Security-first design & guidance",
                },
                {
                  icon: <ScanSearch className="h-5 w-5 text-indigo-600" />,
                  text: "Structured reviews that surface real risk",
                },
                {
                  icon: <Cpu className="h-5 w-5 text-indigo-600" />,
                  text: "Pragmatic automation where it matters",
                },
                {
                  icon: <Users className="h-5 w-5 text-indigo-600" />,
                  text: "Human experts for the hard problems",
                },
              ].map((v, i) => (
                <motion.li
                  key={i}
                  variants={fadeUp}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
                    {v.icon}
                  </span>
                  <span className="text-[15px]">{v.text}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </section>

      {/* ===== Highlights ===== */}
      <section className="relative overflow-hidden bg-gray-50 py-16 md:py-20">
        <img
          src={shape1 as string}
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-6 top-1/3 w-20 animate-spin-slow opacity-20"
        />

        <div className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 lg:flex-row">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45 }}
            className="w-full lg:w-1/2"
          >
            <span className="text-sm font-medium uppercase tracking-wide text-blue-700">
              Work With Us
            </span>
            <h2 className="mt-2 text-3xl font-bold md:text-5xl">
              We craft exceptional security solutions for your decentralized future.
            </h2>

            <motion.ul
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              className="mt-6 space-y-3"
            >
              {[
                {
                  icon: <BadgeCheck className="h-5 w-5 text-indigo-600" />,
                  text: "Transparent methodology mapped to industry best-practices.",
                },
                {
                  icon: <Rocket className="h-5 w-5 text-indigo-600" />,
                  text: "Speed without shortcuts—fit reviews into your release cadence.",
                },
                {
                  icon: <Users className="h-5 w-5 text-indigo-600" />,
                  text: "Partnership mentality—enable your team, don&apos;t block it.",
                },
              ].map((h, i) => (
                <motion.li
                  key={i}
                  variants={fadeUp}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
                    {h.icon}
                  </span>
                  <span className="text-[15px]">{h.text}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="relative w-full lg:w-1/2"
          >
            <div className="absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-tr from-sky-100 to-indigo-100 blur-2xl" />
            <img
              src={vectorImg as string}
              alt="Secure development illustration"
              className="w-full rounded-3xl border border-slate-200 shadow-xl"
            />
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
