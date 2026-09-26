import Link from "next/link";
import Image from "next/image";
export default function SiteHeader({active}:{active:"about"|"vote"|"winners"}) {
return <header className="med-header"><div className="med-header-inner"><Link href="/" aria-label="MedFriend — მთავარი">{active === "winners" ? <span className="award-wordmark">MedFriend<small>MEDICAL CARE AWARD</small></span> : <Image src="/medfriend-logo.png" alt="MedFriend" width={250} height={75} priority className="med-logo" />}</Link><nav aria-label="მთავარი ნავიგაცია">{[["about","/","ჩვენს შესახებ"],["vote","/vote","ხმის მიცემა"],["winners","/winners","გამარჯვებულები"]].map(([id,url,label])=><Link key={id} href={url} aria-current={active===id?"page":undefined}>{label}</Link>)}</nav></div></header>;
}
