"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

type User = { id: string; email: string };
type Profile = { full_name: string; target_roles: string[]; target_countries: string[]; salary_expectation: string; work_authorization: string };
type Cv = { id: string; file_name: string | null; created_at: string };
type Job = { id: string; title: string; company: string; location: string; source_url: string; status: string; match_score: number; strengths: string[]; gaps: string[]; summary: string; tailored_cv: string; cover_letter: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: "include", headers: { "content-type": "application/json", ...init?.headers }, ...init });
  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [view, setView] = useState("Overview");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cv, setCv] = useState<Cv | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [n8nMode, setN8nMode] = useState("mock");
  const [selected, setSelected] = useState<Job | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [profileData, jobData] = await Promise.all([api<{ profile: Profile | null; cv: Cv | null }>("/profile"), api<{ jobs: Job[]; n8nMode: string }>("/jobs")]);
    setProfile(profileData.profile); setCv(profileData.cv); setJobs(jobData.jobs); setN8nMode(jobData.n8nMode);
  }, []);

  useEffect(() => { api<{ user: User }>("/auth/me").then(async ({ user }) => { setUser(user); await refresh(); }).catch(() => setUser(null)).finally(() => setChecking(false)); }, [refresh]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try { const result = await api<{ user: User }>(`/auth/${authMode}`, { method: "POST", body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) }); setUser(result.user); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Authentication failed"); }
    finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try { await api("/profile", { method: "PUT", body: JSON.stringify({ fullName: data.get("fullName"), targetRoles: split(data.get("targetRoles")), targetCountries: split(data.get("targetCountries")), salaryExpectation: data.get("salaryExpectation"), workAuthorization: data.get("workAuthorization") }) }); setNotice("Profile saved."); await refresh(); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  async function saveCv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try { await api("/cv", { method: "POST", body: JSON.stringify({ fileName: data.get("fileName") || "pasted-cv.txt", cvText: data.get("cvText") }) }); setNotice("CV saved securely."); await refresh(); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  async function addJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const data = new FormData(event.currentTarget);
    try { await api("/jobs", { method: "POST", body: JSON.stringify({ title: data.get("title"), company: data.get("company"), location: data.get("location"), sourceUrl: data.get("sourceUrl") }) }); event.currentTarget.reset(); setNotice(`Job evaluated using the ${n8nMode} adapter.`); await refresh(); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  async function jobAction(job: Job, action: "approved" | "rejected" | "status", status = "saved") {
    setBusy(true); setError("");
    try { if (action === "status") await api(`/jobs/${job.id}/status`, { method: "POST", body: JSON.stringify({ status, note: "Updated manually in ApplyPilot" }) }); else await api(`/jobs/${job.id}/decision`, { method: "POST", body: JSON.stringify({ decision: action }) }); setNotice(action === "status" ? `Status updated to ${status}.` : `Opportunity ${action}. No application was submitted.`); await refresh(); }
    catch (reason) { setError(message(reason)); } finally { setBusy(false); }
  }

  async function logout() { await api("/auth/logout", { method: "POST" }); setUser(null); setProfile(null); setJobs([]); }

  if (checking) return <main className="centerState"><div className="spinner" /><h1>Loading ApplyPilot</h1></main>;
  if (!user) return <Auth mode={authMode} setMode={setAuthMode} submit={authenticate} busy={busy} error={error} />;

  const qualified = jobs.filter((job) => job.match_score >= 85).length;
  return <main className="shell">
    <aside className="side"><div className="brand"><b>A</b><span>ApplyPilot</span></div><nav>{["Overview", "Job matches", "Applications", "Documents", "Profile"].map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}><i />{item}</button>)}</nav><div className="automation"><small>{n8nMode === "live" ? "LIVE N8N" : "MOCK N8N ADAPTER"}</small><strong>Your CV controls the search</strong><p>Every record is isolated to your account.</p><em>● Manual approval required</em></div><button className="account" onClick={logout}><span>{user.email.slice(0, 2).toUpperCase()}</span><div><strong>{user.email}</strong><small>Sign out</small></div></button></aside>
    <section className="content"><header><div><small>PRIVATE JOB SEARCH / {view.toUpperCase()}</small><h1>{view === "Overview" ? "Your search workspace." : view}</h1></div><button className="primary" onClick={() => setView("Profile")}>{profile ? "Edit profile" : "Complete profile"}</button></header>
      {error && <button className="notice errorNotice" onClick={() => setError("")}>{error}<b>×</b></button>}{notice && <button className="notice" onClick={() => setNotice("")}>{notice}<b>×</b></button>}
      {view === "Overview" && <><section className="hero"><div><span>{profile && cv ? "SEARCH READY" : "SETUP REQUIRED"}</span><h2>Turn your CV into a focused LinkedIn job search.</h2><p>{profile && cv ? "Add a LinkedIn or employer job URL to evaluate it against your private candidate profile." : "Create your profile and add CV text before evaluating opportunities."}</p><div><button className="primary dark" onClick={() => setView(profile ? "Job matches" : "Profile")}>{profile && cv ? "Add an opportunity →" : "Set up my profile →"}</button></div></div><figure><i /><i /><b>{jobs.length}<small>jobs</small></b></figure></section><section className="stats">{[["OPPORTUNITIES", jobs.length, "Added manually"], ["ABOVE THRESHOLD", qualified, "85% match or better"], ["PROFILE", profile ? "Ready" : "Missing", "Editable anytime"], ["CV", cv ? "Saved" : "Missing", "Private text record"]].map((item) => <article key={item[0]}><small>{item[0]}</small><strong>{item[1]}</strong><p>{item[2]}</p></article>)}</section><JobsPanel jobs={jobs} onSelect={(job) => { setSelected(job); setView("Job matches"); }} n8nMode={n8nMode} /></>}
      {view === "Profile" && <ProfileWorkspace profile={profile} cv={cv} saveProfile={saveProfile} saveCv={saveCv} busy={busy} />}
      {view === "Job matches" && <JobWorkspace jobs={jobs} selected={selected} setSelected={setSelected} addJob={addJob} action={jobAction} busy={busy} profileReady={Boolean(profile && cv)} n8nMode={n8nMode} />}
      {view === "Documents" && <DocumentsWorkspace jobs={jobs} />}
      {view === "Applications" && <ApplicationsWorkspace jobs={jobs} action={jobAction} busy={busy} />}
    </section>
  </main>;
}

function Auth({ mode, setMode, submit, busy, error }: { mode: "login" | "register"; setMode: (mode: "login" | "register") => void; submit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; error: string }) { return <main className="authPage"><section className="authBrand"><div className="brand"><b>A</b><span>ApplyPilot</span></div><h1>Your private, CV-driven job search.</h1><p>Evaluate opportunities, review tailored documents, and keep every submission under your control.</p></section><form className="authCard" onSubmit={submit}><small>PRIVATE MVP</small><h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2><p>{mode === "login" ? "Sign in to your workspace." : "Use a unique password with at least 10 characters."}</p>{error && <div className="formError">{error}</div>}<label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" minLength={10} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label><button className="primary dark" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Register"}</button><button type="button" className="textButton" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}</button></form></main>; }

function ProfileWorkspace({ profile, cv, saveProfile, saveCv, busy }: { profile: Profile | null; cv: Cv | null; saveProfile: (event: FormEvent<HTMLFormElement>) => void; saveCv: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) { return <section className="workspaceGrid"><form className="panel formPanel" onSubmit={saveProfile}><small>CANDIDATE PROFILE</small><h3>Search preferences</h3><label>Full name<input name="fullName" defaultValue={profile?.full_name} required /></label><label>Target roles, comma separated<input name="targetRoles" defaultValue={profile?.target_roles.join(", ")} required /></label><label>Target countries, comma separated<input name="targetCountries" defaultValue={profile?.target_countries.join(", ")} required /></label><label>Salary expectation<input name="salaryExpectation" defaultValue={profile?.salary_expectation} /></label><label>Work authorization<textarea name="workAuthorization" defaultValue={profile?.work_authorization} /></label><button className="primary dark" disabled={busy}>Save profile</button></form><form className="panel formPanel" onSubmit={saveCv}><small>PRIVATE CV</small><h3>{cv ? `Saved: ${cv.file_name ?? "CV text"}` : "Add your CV text"}</h3><label>File label<input name="fileName" placeholder="my-cv.txt" /></label><label>CV text<textarea className="cvInput" name="cvText" minLength={100} placeholder="Paste at least 100 characters. CV contents are never written to logs." required /></label><button className="primary dark" disabled={busy}>Save new CV version</button></form></section>; }

function JobWorkspace({ jobs, selected, setSelected, addJob, action, busy, profileReady, n8nMode }: { jobs: Job[]; selected: Job | null; setSelected: (job: Job | null) => void; addJob: (event: FormEvent<HTMLFormElement>) => void; action: (job: Job, action: "approved" | "rejected" | "status", status?: string) => void; busy: boolean; profileReady: boolean; n8nMode: string }) { return <section className="workspaceGrid"><div><form className="panel formPanel" onSubmit={addJob}><small>MANUAL OPPORTUNITY · {n8nMode.toUpperCase()}</small><h3>Add a LinkedIn or employer job</h3><label>Job title<input name="title" required /></label><label>Company<input name="company" /></label><label>Location<input name="location" /></label><label>Job URL<input name="sourceUrl" type="url" placeholder="https://www.linkedin.com/jobs/view/..." required /></label><button className="primary dark" disabled={busy || !profileReady}>Evaluate opportunity</button>{!profileReady && <p className="helper">Complete your profile and CV first.</p>}</form><JobsPanel jobs={jobs} onSelect={setSelected} n8nMode={n8nMode} /></div>{selected ? <article className="panel detail"><small>MATCH SCORE</small><strong className="bigScore">{selected.match_score}%</strong><h3>{selected.title}</h3><p>{selected.company} · {selected.location}</p><h4>Summary</h4><p>{selected.summary}</p><h4>Strengths</h4><ul>{selected.strengths.map((item) => <li key={item}>{item}</li>)}</ul><h4>Gaps</h4><ul>{selected.gaps.map((item) => <li key={item}>{item}</li>)}</ul><div className="actions"><button onClick={() => action(selected, "approved")} disabled={busy}>Approve</button><button onClick={() => action(selected, "rejected")} disabled={busy}>Reject</button><a href={selected.source_url} target="_blank" rel="noreferrer">Open source ↗</a></div><p className="helper">Approval records your decision only. It never submits an application.</p></article> : <section className="panel empty"><b>J</b><h2>Select a job</h2><p>Its score, evidence, and documents will appear here.</p></section>}</section>; }

function JobsPanel({ jobs, onSelect, n8nMode }: { jobs: Job[]; onSelect: (job: Job) => void; n8nMode: string }) { return <div className="panel jobsPanel"><div className="panelHead"><div><small>OPPORTUNITIES · {n8nMode.toUpperCase()}</small><h3>Evaluated jobs</h3></div></div>{jobs.length ? jobs.map((job) => <button className="job" key={job.id} onClick={() => onSelect(job)}><span className="score"><b>{job.match_score}</b><small>%</small></span><span><h4>{job.title}</h4><p>{job.company} · {job.location}</p></span><span className="jobMeta"><small>{job.status}</small></span><b>→</b></button>) : <div className="inlineEmpty">No opportunities yet. Add a job URL when your profile is ready.</div>}</div>; }

function DocumentsWorkspace({ jobs }: { jobs: Job[] }) { return <section className="documents">{jobs.length ? jobs.map((job) => <article className="panel doc" key={job.id}><small>{job.title}</small><h3>Tailored CV</h3><pre>{job.tailored_cv}</pre><h3>Cover letter</h3><pre>{job.cover_letter}</pre></article>) : <section className="empty panel"><b>D</b><h2>No tailored documents</h2><p>Documents are created when a job is evaluated.</p></section>}</section>; }

function ApplicationsWorkspace({ jobs, action, busy }: { jobs: Job[]; action: (job: Job, action: "approved" | "rejected" | "status", status?: string) => void; busy: boolean }) { return <section className="panel"><div className="panelHead"><div><small>MANUAL PIPELINE</small><h3>Application status</h3></div></div>{jobs.length ? jobs.map((job) => <div className="applicationRow" key={job.id}><div><strong>{job.title}</strong><p>{job.company} · Current: {job.status}</p></div><select value={job.status} disabled={busy} onChange={(event) => action(job, "status", event.target.value)}>{["saved", "preparing", "applied", "interview", "offer", "rejected", "withdrawn"].map((status) => <option key={status}>{status}</option>)}</select></div>) : <div className="inlineEmpty">No opportunities in your pipeline.</div>}</section>; }

function split(value: FormDataEntryValue | null) { return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean); }
function message(reason: unknown) { return reason instanceof Error ? reason.message : "Request failed"; }
