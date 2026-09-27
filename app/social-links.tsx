// Add the official profile URLs here when supplied by the MedFriend team.
const profiles = [
  { name: "Facebook", url: "", label: "სიახლეები და ღონისძიებები", icon: "facebook" },
  { name: "Instagram", url: "", label: "ჩვენი ამბები ფოტოებში", icon: "instagram" },
];

export default function SocialLinks() {
  return <section className="med-social" aria-labelledby="social-title">
    <div><span className="med-eyebrow">დარჩი ჩვენთან</span><h2 id="social-title">MedFriend სოციალურ ქსელებში</h2><p>გაიცანი ჩვენი ამბები და თვალი ადევნე პროექტის სიახლეებს.</p></div>
    <div className="med-social-grid">{profiles.map(profile=>{
      const content=<><span className="med-social-icon" aria-hidden="true">{profile.icon==="facebook"?<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.5A26 26 0 0 0 15 1c-3 0-5 1.8-5 5v3H7v4h3v9Z"/></svg>:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>}</span><span><strong>{profile.name}</strong><small>{profile.label}</small></span><span className="med-social-status">{profile.url?"↗":"მალე"}</span></>;
      return profile.url?<a key={profile.name} className="med-social-card" href={profile.url} target="_blank" rel="noopener noreferrer" aria-label={`${profile.name} — ახალ ჩანართში`}>{content}</a>:<div key={profile.name} className="med-social-card">{content}</div>;
    })}</div>
  </section>;
}
