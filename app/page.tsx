"use client";
import { useState } from "react";

const formUrl="https://khaled021.app.n8n.cloud/form/ai-job-profile-v1";
const jobs=[
 {score:96,role:"Automation Engineer",company:"Acme Cloud",place:"Remote",salary:"$55k–70k",state:"Ready for review"},
 {score:91,role:"AI Integration Engineer",company:"Northstar Labs",place:"Amman · Hybrid",salary:"$48k–62k",state:"Documents ready"},
 {score:87,role:"Workflow Engineer",company:"Orbit Systems",place:"Dubai · Remote",salary:"$60k–78k",state:"Review gaps"},
];

export default function Home(){
 const [view,setView]=useState("Overview"); const [notice,setNotice]=useState("");
 return <main className="shell">
  <aside className="side">
   <div className="brand"><b>A</b><span>ApplyPilot</span></div>
   <nav>{["Overview","Job matches","Applications","Documents","Profile"].map(x=><button key={x} className={view===x?"active":""} onClick={()=>setView(x)}><i/>{x}</button>)}</nav>
   <div className="automation"><small>AUTOMATION</small><strong>Daily search at 08:00</strong><p>Your profile controls every search and score.</p><em>● Setup required</em></div>
   <div className="account"><span>KB</span><div><strong>Your workspace</strong><small>Private dashboard</small></div></div>
  </aside>
  <section className="content">
   <header><div><small>JOB SEARCH ASSISTANT / {view.toUpperCase()}</small><h1>{view==="Overview"?"Good morning.":view}</h1></div><a className="primary" href={formUrl} target="_blank">Complete your profile ↗</a></header>
   {view==="Overview"?<>
    <section className="hero"><div><span>PROFILE SETUP</span><h2>Turn your CV into a focused job search.</h2><p>Add your CV, target countries, roles, salary expectations, and work authorization. You can change everything later.</p><div><a className="primary dark" href={formUrl} target="_blank">Set up my search ↗</a><button onClick={()=>setNotice("The workflow searches only approved APIs, feeds, alerts, and URLs you provide.")}>How it works</button></div></div><figure><i/><i/><b>96<small>match</small></b></figure></section>
    {notice&&<button className="notice" onClick={()=>setNotice("")}>{notice}<b>×</b></button>}
    <section className="stats">{[["NEW MATCHES","12","+4 since yesterday"],["ABOVE THRESHOLD","3","85% match or better"],["AWAITING REVIEW","2","Your decision is needed"],["READY TO APPLY","1","Manual submission"]].map(x=><article key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><p>{x[2]}</p></article>)}</section>
    <section className="columns">
     <div className="panel"><div className="panelHead"><div><small>TODAY’S SHORTLIST</small><h3>Best matches</h3></div><button onClick={()=>setView("Job matches")}>View all →</button></div>{jobs.map((j,n)=><article className="job" key={j.company}><div className={`score s${n}`}><b>{j.score}</b><small>%</small></div><div><h4>{j.role}</h4><p>{j.company} · {j.place}</p></div><div className="jobMeta"><span>{j.salary}</span><small>{j.state}</small></div><button onClick={()=>setNotice(`${j.role} is ready for evidence and document review.`)}>→</button></article>)}</div>
     <div className="panel"><div className="panelHead"><div><small>APPLICATION PIPELINE</small><h3>Progress</h3></div><em>● Live</em></div>{[["Evaluated",8,88],["Qualified",3,55],["Awaiting approval",2,38],["Ready to submit",1,22]].map(x=><div className="pipe" key={x[0]}><div><span>{x[0]}</span><b>{x[1]}</b></div><p><i style={{width:`${x[2]}%`}}/></p></div>)}<div className="guard"><b>✓</b><div><strong>Human approval is always required</strong><p>No application is submitted automatically.</p></div></div></div>
    </section>
   </>:<section className="empty"><b>{view[0]}</b><h2>{view} workspace</h2><p>This surface is ready for live data from your n8n workflow. Complete your profile and connect an authorized job source to populate it.</p><a className="primary dark" href={formUrl} target="_blank">Open profile setup ↗</a></section>}
  </section>
 </main>
}
