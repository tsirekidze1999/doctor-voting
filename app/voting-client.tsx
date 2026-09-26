"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "./site-header";
import { normalizePhone } from "@/src/phone";

type Election = { id: number; title: string; description: string | null; startsAt: string; endsAt: string; isActive: boolean; winnerPublished: boolean };
type Category = { id: number; name: string };
type Candidate = { id: number; categoryId: number; firstName: string; lastName: string; specialty: string | null; photoUrl?: string | null; votes?: number };
type Step = "confirm" | "phone" | "otp";
const button = "flex-1 bg-black text-white py-3 px-4 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const secondary = "flex-1 border border-gray-300 py-3 px-4 rounded-xl cursor-pointer disabled:opacity-50";
function formatRemaining(end: string, now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(end) - now) / 1000));
  const days = Math.floor(seconds / 86400), hours = Math.floor((seconds % 86400) / 3600), minutes = Math.floor((seconds % 3600) / 60);
  return days > 0 ? `${days} დღე და ${hours} საათი` : hours > 0 ? `${hours} საათი და ${minutes} წუთი` : `${minutes} წუთი`;
}

export default function VotingPage({ resultsOnly = false }: { resultsOnly?: boolean }) {
  const [election, setElection] = useState<Election | null>(null);
  const [doctors, setDoctors] = useState<Candidate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Candidate | null>(null);
  const [step, setStep] = useState<Step>("confirm");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [delivery, setDelivery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [queue, setQueue] = useState<{ allowed: boolean; position: number } | null>(null);
  const busy = useRef(false);
  const name = selectedDoctor ? selectedDoctor.firstName + " " + selectedDoctor.lastName : "";

  const searchWords = search.trim().normalize("NFKC").toLocaleLowerCase("ka").split(/\s+/).filter(Boolean);
  const filteredDoctors = doctors.filter(doctor => {
    const fullName = (doctor.firstName + " " + doctor.lastName).normalize("NFKC").toLocaleLowerCase("ka");
    return (activeCategory === "all" || doctor.categoryId === activeCategory) && searchWords.every(word => fullName.includes(word));
  });
  const categoryButton = (active: boolean) => "rounded-full px-4 py-2 text-sm font-medium border transition-colors " + (active ? "bg-blue-800 border-blue-800 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100");
  const selectedCategoryName = categories.find(category => category.id === selectedDoctor?.categoryId)?.name;

  useEffect(() => {
    const clientId = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
    let active = true;
    async function checkQueue() {
      const response = await fetch(`/api/traffic?clientId=${clientId}`, { cache: "no-store" });
      const data = await response.json();
      if (active) setQueue({ allowed: data.allowed, position: data.position || 0 });
      return data.allowed;
    }
    void checkQueue().catch(() => { if (active) setQueue({ allowed: true, position: 0 }); });
    const timer = window.setInterval(() => { void checkQueue().catch(() => undefined); }, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (queue && !queue.allowed) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/election", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "არჩევნების ჩატვირთვა ვერ მოხერხდა");
        setElection(data.election);
        setDoctors(data.candidates);
        setCategories(data.categories);
      } catch (err) {
        if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : "სერვერთან დაკავშირება ვერ მოხერხდა");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [queue]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  function close() {
    if (busy.current) return;
    setSelectedDoctor(null);
    setStep("confirm");
    setOtp("");
    setChallengeId(null);
    setError("");
    setDelivery("");
  }

  async function sendOtp() {
    if (busy.current || !election || !selectedDoctor) return;
    const normalized = normalizePhone(phone);
    if (!normalized) { setError("შეიყვანეთ ქართული მობილურის ნომერი, მაგალითად 5XX XXX XXX"); return; }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, electionId: election.id, candidateId: selectedDoctor.id }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "კოდის მოთხოვნა ვერ მოხერხდა"); return; }
      setPhone(data.phone);
      setChallengeId(data.challengeId);
      setDelivery(data.delivery);
      setOtp("");
      setStep("otp");
    } catch { setError("სერვერთან დაკავშირება ვერ მოხერხდა. სცადეთ ხელახლა."); }
    finally { busy.current = false; setPending(false); }
  }

  async function verifyOtp() {
    if (busy.current || !election || !selectedDoctor || !challengeId) return;
    if (!/^\d{6}$/.test(otp)) { setError("შეიყვანეთ 6-ნიშნა კოდი"); return; }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, challengeId, electionId: election.id, candidateId: selectedDoctor.id }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "ხმის შენახვა ვერ მოხერხდა"); return; }
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setSelectedDoctor(null);
      setChallengeId(null);
      setOtp("");
      setStep("confirm");
    } catch { setError("პასუხი ვერ მივიღეთ. სცადეთ ხელახლა; დუბლიკატი ხმა არ ჩაიწერება."); }
    finally { busy.current = false; setPending(false); }
  }

  return (
    <main className="site-shell min-h-screen text-gray-900">
      <SiteHeader active={resultsOnly ? "winners" : "vote"} />
      {queue && !queue.allowed && <section className="queue-screen"><div className="queue-card"><span className="eyebrow">მაღალი დატვირთვა</span><h1>თქვენ რიგში ხართ</h1><p>საიტზე შესვლას მალე შეძლებთ. თქვენი რიგის ნომერია:</p><strong>#{queue.position}</strong><small>გვერდი ავტომატურად შემოწმდება ყოველ რამდენიმე წამში.</small></div></section>}
      {queue?.allowed !== false && <>
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="intro text-center mb-10">
          <span className="eyebrow">ხალხის არჩევანი</span><h1 className="text-4xl font-bold">{election?.title || "წლის საუკეთესო ექიმი"}</h1>
          <p className="mt-4 text-gray-600">{election?.description || "აირჩიე შენი ფავორიტი ექიმი და მიეცი ხმა."}</p>
          {election?.isActive && <div className="countdown" role="status">დასრულებამდე დარჩა <strong>{formatRemaining(election.endsAt, now)}</strong></div>}
        </div>
        {loading && <p role="status" className="text-center">იტვირთება...</p>}
        {loadError && <div role="alert" className="text-center text-red-700"><p>{loadError}</p><button className="mt-3 underline" onClick={() => window.location.reload()}>ხელახლა ცდა</button></div>}
        {!loading && !loadError && !election && <p className="text-center">ამჟამად აქტიური არჩევნები არ მიმდინარეობს.</p>}
        {resultsOnly && !loading && !loadError && !election?.winnerPublished && <div className="award-empty"><span aria-hidden="true">✦</span><h2>გამარჯვებულების დრო ჯერ წინ არის</h2><p>დადასტურებული შედეგები გამოქვეყნების შემდეგ აქ გამოჩნდება.</p></div>}
        {election?.winnerPublished && <section className="award-section"><span className="award-star" aria-hidden="true">✦</span><h2>ვულოცავთ გამარჯვებულებს!</h2><p>მადლობა თითოეულ მონაწილეს — დადასტურებული შედეგები</p><div className="award-grid">{categories.map(category => { const group = doctors.filter(d => d.categoryId === category.id); const max = Math.max(0, ...group.map(d => d.votes ?? 0)); const leaders = max > 0 ? group.filter(d => (d.votes ?? 0) === max) : []; return <article className="award-card" key={category.id}><span aria-hidden="true">✧</span><h3>{category.name}</h3>{leaders.length ? leaders.map(d => <div key={d.id}><strong>{d.firstName} {d.lastName}</strong><p>{max} ხმა</p></div>) : <p>ამ კატეგორიაში ხმა არ დაფიქსირებულა</p>}</article>; })}</div></section>}
        {success && <div role="status" className="mb-8 rounded-xl bg-green-100 p-6 text-center text-green-900 text-xl font-bold">მადლობა, თქვენი ხმა მიღებულია. შეგიძლიათ სხვა კატეგორიაშიც მისცეთ ხმა.</div>}
        {election && election.isActive && !resultsOnly && !loading && !loadError && (
          <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <label htmlFor="doctor-search" className="block font-semibold">მოძებნე ექიმი</label>
            <div className="mt-3 flex gap-2">
              <input id="doctor-search" type="search" value={search} maxLength={100}
                onChange={(event) => { setSearch(event.target.value); setActiveCategory("all"); }}
                placeholder="ჩაწერე სახელი ან გვარი..."
                className="min-w-0 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-700" />
              {search && <button onClick={() => setSearch("")} className="px-3 text-sm underline">გასუფთავება</button>}
            </div>
            <p className="mt-2 text-sm text-gray-500">სახელის ან გვარის ნაწილით მოძებნე ექიმი ყველა კატეგორიაში.</p>
            <div aria-label="ექიმის კატეგორია" className="mt-5 flex flex-wrap gap-2">
              <button aria-pressed={activeCategory === "all"} onClick={() => setActiveCategory("all")}
                className={categoryButton(activeCategory === "all")}>ყველა კატეგორია</button>
              {categories.map((category) => (
                <button key={category.id} aria-pressed={activeCategory === category.id}
                  onClick={() => setActiveCategory(category.id)} className={categoryButton(activeCategory === category.id)}>{category.name}</button>
              ))}
            </div>
            <p className="mt-5 text-sm text-gray-600">ერთ ნომერს თითოეულ კატეგორიაში ერთი ხმის მიცემა შეუძლია.</p>
            <p role="status" className="mt-2 text-sm font-medium">ნაპოვნია {filteredDoctors.length} ექიმი</p>
          </div>
        )}
        {election && election.isActive && !resultsOnly && !loading && !loadError && filteredDoctors.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center">
            <p className="font-semibold">ექიმი ვერ მოიძებნა</p>
            <p className="mt-2 text-gray-500">შეცვალე საძიებო სიტყვა ან კატეგორია.</p>
            <button onClick={() => { setSearch(""); setActiveCategory("all"); }} className="mt-4 underline">ყველა ექიმის ჩვენება</button>
          </div>
        )}
        {election && election.isActive && !resultsOnly && categories.filter(category => filteredDoctors.some(doctor => doctor.categoryId === category.id)).map(category => (
          <section key={category.id} aria-labelledby={"category-" + category.id} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 id={"category-" + category.id} className="text-2xl font-bold">{category.name}</h2>
              <span className="rounded-full bg-gray-200 px-3 py-1 text-sm">{filteredDoctors.filter(doctor => doctor.categoryId === category.id).length} ექიმი</span>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {filteredDoctors.filter(doctor => doctor.categoryId === category.id).map(doctor => (
                <div key={doctor.id} className="doctor-card bg-white rounded-2xl shadow p-6">
                  <div className="doctor-photo h-48 rounded-xl mb-5 flex items-center justify-center overflow-hidden">{doctor.photoUrl ? <img src={doctor.photoUrl} alt={`${doctor.firstName} ${doctor.lastName}`} className="h-full w-full object-cover" /> : <span>{doctor.firstName.slice(0,1)}{doctor.lastName.slice(0,1)}</span>}</div>
                  <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">{category.name}</span>
                  <h3 className="mt-3 text-xl font-bold">{doctor.firstName} {doctor.lastName}</h3>
                  <p className="text-gray-500 mt-2">{doctor.specialty}</p>
                  <button onClick={() => { setSelectedDoctor(doctor); setStep("confirm"); setError(""); setSuccess(false); }}
                    className="mt-5 w-full bg-black text-white py-3 rounded-xl active:scale-95 transition-transform cursor-pointer">ხმის მიცემა</button>
                </div>
              ))}
            </div>
          </section>
        ))}

      </section>
      </>}
      {selectedDoctor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="vote-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 id="vote-title" className="text-2xl font-bold">{step === "confirm" ? "ხმის მიცემა" : step === "phone" ? "მობილურის ნომერი" : "კოდის დადასტურება"}</h2>
            {step === "confirm" ? (
              <>
                <p className="mt-4 text-gray-600">ნამდვილად გსურთ ხმა მისცეთ <strong className="text-gray-900">{name}</strong> კატეგორიაში „{selectedCategoryName}“?</p>
                <div className="flex gap-3 mt-6"><button onClick={close} className={secondary}>გაუქმება</button><button onClick={() => setStep("phone")} className={button}>დადასტურება</button></div>
              </>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void (step === "phone" ? sendOtp() : verifyOtp()); }}>
                <p className="mt-4 text-gray-600">კატეგორია: {selectedCategoryName}<br />თქვენი არჩევანი: <strong className="text-gray-900">{name}</strong></p>
                {step === "phone" ? (
                  <>
                    <label htmlFor="phone" className="block mt-6 text-sm font-medium">მობილურის ნომერი</label>
                    <input id="phone" type="tel" autoComplete="tel" autoFocus required maxLength={32} disabled={pending}
                      value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="5XX XXX XXX"
                      className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black" />
                    <p className="mt-2 text-sm text-gray-600">საქართველოს ნომერი (+995). ერთ ნომერს თითოეულ კატეგორიაში ერთი ხმის მიცემა შეუძლია.</p>
                  </>
                ) : (
                  <>
                    <p className="mt-4">{phone}</p>
                    <p className="mt-2 text-sm text-gray-600">{delivery === "console" ? "სატესტო რეჟიმი: SMS ჯერ არ იგზავნება. 6-ნიშნა კოდი ნახეთ საიტის ტერმინალში." : "შეიყვანეთ SMS-ით მიღებული 6-ნიშნა კოდი."}</p>
                    <label htmlFor="otp" className="block mt-6 text-sm font-medium">OTP კოდი</label>
                    <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={6}
                      disabled={pending} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                      placeholder="123456" className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-black" />
                    <button type="button" disabled={pending} onClick={() => void sendOtp()} className="mt-3 text-sm underline disabled:opacity-50">ახალი კოდის მიღება</button>
                    <p className="mt-1 text-xs text-gray-500">ახალი კოდის მიღება შეგიძლიათ საჭიროების შემთხვევაში.</p>
                  </>
                )}
                {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
                <div className="flex gap-3 mt-6">
                  <button type="button" disabled={pending} className={secondary} onClick={() => { setStep(step === "otp" ? "phone" : "confirm"); setOtp(""); setChallengeId(null); setError(""); }}>უკან</button>
                  <button type="submit" disabled={pending} className={button}>{pending ? "მუშავდება..." : step === "phone" ? "კოდის მიღება" : "დადასტურება"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}


