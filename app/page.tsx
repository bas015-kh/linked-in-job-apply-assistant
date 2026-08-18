"use client";

import { useState } from "react";

const formUrl = "https://khaled021.app.n8n.cloud/form/ai-job-profile-v1";
const linkedInJobsUrl = "https://www.linkedin.com/jobs/";

export default function Home() {
  const [view, setView] = useState("Overview");
  const [notice, setNotice] = useState("");

  return (
    <main className="shell">
      <aside className="side">
        <div className="brand"><b>A</b><span>ApplyPilot</span></div>
        <nav>{["Overview", "Job matches", "Applications", "Documents", "Profile"].map((item) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}><i />{item}</button>
        ))}</nav>
        <div className="automation"><small>LINKEDIN-FIRST SEARCH</small><strong>Your CV controls the search</strong><p>Roles and countries come from your editable profile—not a fixed template.</p><em>● Source connection required</em></div>
        <div className="account"><span>KB</span><div><strong>Your workspace</strong><small>Private dashboard</small></div></div>
      </aside>
      <section className="content">
        <header><div><small>JOB SEARCH ASSISTANT / {view.toUpperCase()}</small><h1>{view === "Overview" ? "Good morning." : view}</h1></div><a className="primary" href={formUrl} target="_blank" rel="noreferrer">Complete your profile ↗</a></header>
        {view === "Overview" ? <>
          <section className="hero"><div><span>CV-BASED SEARCH</span><h2>Turn your CV into a focused LinkedIn job search.</h2><p>Upload your CV, choose your countries, and adjust roles, salary expectations, and work authorization whenever you want.</p><div><a className="primary dark" href={formUrl} target="_blank" rel="noreferrer">Set up my search ↗</a><button onClick={() => setNotice("ApplyPilot ranks jobs against your CV. It opens LinkedIn for review and never submits an application without your approval.")}>How it works</button></div></div><figure><i /><i /><b>CV<small>driven</small></b></figure></section>
          {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<b>×</b></button>}
          <section className="stats">{[["NEW MATCHES", "0", "Waiting for a live source"], ["ABOVE THRESHOLD", "0", "CV score of 85%+"], ["AWAITING REVIEW", "0", "You make every decision"], ["READY TO APPLY", "0", "Manual submission only"]].map((item) => <article key={item[0]}><small>{item[0]}</small><strong>{item[1]}</strong><p>{item[2]}</p></article>)}</section>
          <section className="columns">
            <div className="panel sourceSetup"><div className="linkedin">in</div><small>PRIMARY JOB DESTINATION</small><h3>LinkedIn Jobs</h3><p>Matches will appear here after an authorized source is connected. Until then, use your CV profile to create a focused search and review roles directly on LinkedIn.</p><div><a href={linkedInJobsUrl} target="_blank" rel="noreferrer">Open LinkedIn Jobs ↗</a><button onClick={() => setView("Profile")}>Edit search preferences</button></div></div>
            <div className="panel"><div className="panelHead"><div><small>APPLICATION PIPELINE</small><h3>Progress</h3></div><em>● Ready</em></div>{[["Evaluated", 0, 0], ["Qualified", 0, 0], ["Awaiting approval", 0, 0], ["Ready to submit", 0, 0]].map((item) => <div className="pipe" key={item[0]}><div><span>{item[0]}</span><b>{item[1]}</b></div><p><i style={{ width: `${item[2]}%` }} /></p></div>)}<div className="guard"><b>✓</b><div><strong>Human approval is always required</strong><p>No application is submitted automatically.</p></div></div></div>
          </section>
        </> : <section className="empty"><b>{view[0]}</b><h2>{view} workspace</h2><p>This area will use live results from your n8n workflow. Complete your CV profile and connect an authorized source to populate it.</p><a className="primary dark" href={formUrl} target="_blank" rel="noreferrer">Open profile setup ↗</a></section>}
      </section>
    </main>
  );
}
