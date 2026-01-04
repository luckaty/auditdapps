// src/pages/Contact.tsx
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, Mail, MapPin } from "lucide-react";
import ThreeJsBackdrop from "../components/ThreeJsBackdrop";
import bgImg from "../assets/img/hero_bg_2_1.jpg";

// 🔹 NEW imports
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { container, fadeUp } from "@/lib/motion";


export default function Contact() {
  

  // 🔹 NEW state for form fields + loading
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // 🔹 NEW submit handler calling Supabase Edge Function (Resend)
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-contact-message",
        {
          body: {
            name,
            email,
            phone,
            subject,
            message,
          },
        }
      );

      if (error) {
        console.error("[Contact] send-contact-message error:", error);
        toast.error(
          "We couldn’t send your message right now. Please try again in a moment."
        );
        return;
      }

      const ok = (data as any)?.ok ?? true;
      if (!ok) {
        console.error("[Contact] send-contact-message returned not ok:", data);
        toast.error(
          "We couldn’t send your message right now. Please try again in a moment."
        );
        return;
      }

      toast.success("Thanks! We received your message.");
      // reset form
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("[Contact] unexpected error:", err);
      toast.error(
        "We couldn’t send your message right now. Please try again in a moment."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="text-gray-800">
      {/* ====================== Hero ====================== */}
      <section className="relative overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={bgImg}
            alt="Abstract security background"
            className="h-[380px] w-full object-cover md:h-[460px]"
          />
          {/* 3D Backdrop (subtle, behind the tint) */}
          <div className="absolute inset-0">
            <ThreeJsBackdrop modelPath="/models/network.glb" />
          </div>
          {/* Tint */}
          <div className="absolute inset-0 bg-black/50" />
          {/* Soft gradient at bottom to blend into page */}
          <div className="absolute inset-x-0 bottom-[-100px] h-[200px] bg-gradient-to-b from-transparent to-white" />
        </div>

        {/* Foreground content */}
        <div className="relative z-10">
          <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:pb-24 md:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-3xl text-center text-white"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/20">
                We’d love to help
              </span>
              <h1 className="mt-3 text-4xl font-bold md:text-5xl">
                Contact <span className="text-blue-300">Audit Dapps</span>
              </h1>

              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className="mt-4 flex justify-center">
                <ol className="inline-flex items-center space-x-2 text-white/80">
                  <li>
                    <Link
                      to="/"
                      className="transition hover:text-white hover:underline"
                    >
                      Home
                    </Link>
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="mx-1 h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium" aria-current="page">
                      Contact
                    </span>
                  </li>
                </ol>
              </nav>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ====================== Info Cards ====================== */}
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3"
          >
            {/* Phone */}
            <motion.div
              variants={fadeUp}
              className="group relative rounded-2xl border border-slate-200 bg-gradient-to-tr from-blue-50 to-white p-8 shadow-lg transition hover:shadow-xl"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 ring-1 ring-blue-200">
                <Phone className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Phone Number</h3>
              <a
                href="tel:+5695832593256"
                className="mt-1 inline-block text-blue-600 hover:underline"
              >
                +447778883824
              </a>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 transition group-hover:ring-2 group-hover:ring-blue-200" />
            </motion.div>

            {/* Email */}
            <motion.div
              variants={fadeUp}
              className="group relative rounded-2xl border border-slate-200 bg-gradient-to-tr from-blue-50 to-white p-8 shadow-lg transition hover:shadow-xl"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 ring-1 ring-blue-200">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Email Address</h3>
              <a
                href="mailto:info@auditdapps.com"
                className="mt-1 inline-block break-all text-blue-600 hover:underline"
              >
                info@auditdapps.com
              </a>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 transition group-hover:ring-2 group-hover:ring-blue-200" />
            </motion.div>

            {/* Address */}
            <motion.div
              variants={fadeUp}
              className="group relative rounded-2xl border border-slate-200 bg-gradient-to-tr from-blue-50 to-white p-8 shadow-lg transition hover:shadow-xl"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700 ring-1 ring-blue-200">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold">Our Address</h3>
              <p className="mt-1 text-slate-700">
                27 Clinton Road, London, United Kingdom.
              </p>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 transition group-hover:ring-2 group-hover:ring-blue-200" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ====================== Contact Form ====================== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            {/* Left copy */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45 }}
            >
              <span className="mb-3 inline-block rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700">
                Have any question?
              </span>
              <h2 className="text-3xl font-bold md:text-4xl">
                Let’s dive into a discussion
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-slate-600">
                Whether you need technical guidance, want to scope a manual
                audit, or have questions about self-audits and certification,
                we’re here to help.
              </p>

              {/* Socials */}
              <div className="mt-8">
                <h3 className="mb-3 text-lg font-semibold text-gray-800">
                  Follow us
                </h3>
                <div className="flex gap-3">
                  {/* ... socials unchanged ... */}
                  {/* (keeping your existing SVG links exactly as-is) */}
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
                    aria-label="Facebook"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                    </svg>
                  </a>
                  {/* (rest of socials unchanged for brevity) */}
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-full bg-black text-white transition-colors hover:bg-gray-800"
                    aria-label="Twitter"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white transition-colors hover:from-purple-600 hover:to-pink-600"
                    aria-label="Instagram"
                  >
                    {/* ... SVG unchanged ... */}
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      {/* paths omitted for brevity */}
                      <path
                        fillRule="evenodd"
                        d="M12.315 2c2.43 0 2.784.013 3.808.06 ..."
                        clipRule="evenodd"
                      />
                    </svg>
                  </a>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-full bg-blue-700 text-white transition-colors hover:bg-blue-800"
                    aria-label="LinkedIn"
                  >
                    {/* ... */}
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M19 0h-14C2.239 0 0 2.239 0 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5V5c0-2.761-2.238-5-5-5zM8 19H5V8h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764S5.534 3.204 6.5 3.204s1.75.79 1.75 1.764-.784 1.764-1.75 1.764zM20 19h-3v-5.604c0-3.368-4-3.113-4 0V19h-3V8h3v1.765c1.396-2.586 7-2.777 7 2.476V19z" />
                    </svg>
                  </a>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
                    aria-label="YouTube"
                  >
                    {/* ... */}
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
                    </svg>
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              {/* gradient glow */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 opacity-25 blur" />
              <div className="relative rounded-2xl bg-white p-8 shadow-xl">
                <h3 className="text-2xl font-bold">Fill the contact form</h3>
                <p className="mt-1 text-slate-500">
                  We’ll get back to you shortly.
                </p>

                <form
                  className="mt-6 space-y-5"
                  // 🔹 use our handler instead of alert
                  onSubmit={handleSubmit}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="name"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Your Name*
                      </label>
                      <input
                        id="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Your Email*
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Phone Number*
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="subject"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Subject*
                      </label>
                      <input
                        id="subject"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Your Message*
                    </label>
                    <textarea
                      id="message"
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sending ? "Sending…" : "Submit"}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
