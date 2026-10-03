export type BotContext={elections:{id:number;title:string;startsAt:string;endsAt:string;isActive:boolean;winnerPublished:boolean}[];doctors:{firstName:string;lastName:string;specialty:string|null;category:string;electionId:number}[]};
export function normalizeQuestion(value:string){
 const pairs:Record<string,string>={sh:'შ',ch:'ჩ',ts:'ც',dz:'ძ',kh:'ხ',gh:'ღ',zh:'ჟ',th:'თ'};
 const letters:Record<string,string>={a:'ა',b:'ბ',g:'გ',d:'დ',e:'ე',v:'ვ',z:'ზ',t:'ტ',i:'ი',k:'კ',l:'ლ',m:'მ',n:'ნ',o:'ო',p:'პ',r:'რ',s:'ს',u:'უ',f:'ფ',q:'ქ',y:'ყ',j:'ჯ',h:'ჰ',c:'ც',w:'წ',x:'ხ'};
 return value.toLowerCase().replace(/[a-z]+/g,word=>['sms','support','operator','human','hello','hi','thanks'].includes(word)?word:word.replace(/sh|ch|ts|dz|kh|gh|zh|th|[a-z]/g,c=>pairs[c]||letters[c]||c)).replace(/\s+/g,' ').trim();
}
export function knowledgeIntent(question:string,history:string[]=[]){const q=normalizeQuestion(question),previous=normalizeQuestion(history[0]||'');return /(ექიმ|დოქტორ|მოძებ|მომიძებ|სტომატოლოგ|ქირურგ|კარდიოლოგ)/.test(q)||(/(ექიმ|მოძებ|მომიძებ)/.test(previous)&&q.length<80&&!/(გამარჯ|სალამ|მადლობ|sms|სმს|კოდ|ოპერატორ|არჩევნ|როდის|შედეგ|გამარჯვ|ავტორ|შემქმნელ|შექმნა|ხმა|მივცე)/.test(q))?'doctor':/(არჩევნ|როდის|დაიწყ|დასრულ|გაითიშ)/.test(q)?'election':null;}
export function botAnswer(question:string):string|null{
 const q=normalizeQuestion(question);
 if(/(ვინ.*(შექმნა|გააკეთა|ააწყო)|ავტორი|შემქმნელი|who.*(created|built))/.test(q))return 'საიტი შექმნილია MedFriend-ის პროექტისთვის.';
 if(/^(გამარჯობა|სალამი|გამარჯობათ|hello|hi)/.test(q)&&q.length<30)return 'გამარჯობა! მიხარია შენი ნახვა 💙 რით შემიძლია დაგეხმარო MedFriend-ზე?';
 if(/^(მადლობა|გმადლობ|thanks|thank you)/.test(q))return 'სიამოვნებით! 💙 თუ სხვა კითხვა აღარ გაქვს, დაასრულე საუბარი და შეაფასე დახმარება.';
 if(/(sms|სმს|კოდი|კოდს)/.test(q))return 'SMS არ მოდის, მიღებული კოდი არ მიიღება, თუ კოდის მოთხოვნისას შეცდომას ხედავ? მომწერე რომელი შემთხვევაა — თავად კოდი არ გამომიგზავნო.';
 if(/(შედეგ|გამარჯვებულ)/.test(q))return 'შედეგები გამოჩნდება ადმინისტრაციის ოფიციალური დადასტურების შემდეგ. გამარჯვებულები და არქივი: /winners';
 if(/(ხმა|ხმას|მივცე|კატეგორი)/.test(q))return 'ხმის მიცემის გვერდზე /vote აირჩიე კატეგორია და ექიმი, მიუთითე მობილური და დაადასტურე SMS კოდით. ერთ ნომერს თითოეულ კატეგორიაში ერთი ხმა შეუძლია. ხმის მიცემა მხოლოდ მიმდინარე არჩევნებშია გახსნილი.';
 if(/(მობილურ|ტელეფონ|ბრაუზერ)/.test(q))return 'საიტი მობილურ ბრაუზერშიც მუშაობს. განაახლე გვერდი და გადაამოწმე ინტერნეტი. თუ კონკრეტული ღილაკი არ მუშაობს, მომწერე რომელ გვერდზე ხარ და რას ხედავ.';
 return null;
}
export function botResponse(question:string,history:string[]=[],context?:BotContext){
 const q=normalizeQuestion(question),past=history.map(normalizeQuestion),human=/(ოპერატორ|ადამიანთან|სუპორტ|support|operator|human)/.test(q);
 const fail=/(მაინც|კვლავ|არ დამეხმარ|ვერ გამოვასწორ)/.test(q);
 const handoff=(requested=false)=>({name:'ნია',text:requested?'ოპერატორთან დაკავშირების მოთხოვნა მიღებულია. ჩვენი გუნდი ამ მიმოწერაში გიპასუხებს. 💙':'ზუსტი პასუხისთვის ოპერატორის დახმარება გვჭირდება. საუბრის ისტორია გუნდს გადავეცი — პასუხს აქ მიიღებ. 💙',escalate:true});
 if(human)return handoff(true);if(fail)return handoff();
 let answer:string|null=null,name='ნია';const intent=knowledgeIntent(question,history);
 if(intent&&context){const now=Date.now(),elections=context.elections.filter(e=>Date.parse(e.endsAt)>now);const ongoing=elections.filter(e=>e.isActive&&Date.parse(e.startsAt)<=now);const date=(s:string)=>new Intl.DateTimeFormat('ka-GE',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tbilisi'}).format(new Date(s));
 if(intent==='election'){answer=elections.length?elections.slice(0,5).map(e=>e.title+' — '+(e.isActive?(Date.parse(e.startsAt)<=now?'მიმდინარეობს':'დაგეგმილია'):'შეჩერებულია')+'. დაწყება: '+date(e.startsAt)+'; დასრულება: '+date(e.endsAt)+'.').join('\n')+'\nთბილისის დრო. ხმის მიცემა: /vote':'ამჟამად მიმდინარე ან მომავალი არჩევნები არ არის. გამოქვეყნებული შედეგები: /winners';}
 else {const tokens=q.split(/[^ა-ჰa-z]+/).filter(t=>t.length>2&&!/^(ექიმ|დოქტორ|მოძებ|მომიძებ|მინდა|სად|არის|როგორ|ვიპოვ|ერთი|მომეც|სახელ|გვარ|მომწერ|შეგიძლ|გთხოვ)/.test(t));const publicDoctors=context.doctors.filter(d=>elections.some(e=>e.id===d.electionId));const matches=tokens.length?publicDoctors.filter(d=>tokens.every(t=>normalizeQuestion(d.firstName+' '+d.lastName+' '+(d.specialty||'')+' '+d.category).includes(t))):[];
 answer=!tokens.length?'რომელი ექიმის პოვნა გინდა? მომწერე სახელი, გვარი ან სპეციალობა.':!matches.length?'ამ სახელით ან სპეციალობით მიმდინარე და მომავალი არჩევნების მონაწილე ვერ ვიპოვე. გადაამოწმე სახელი ან მხოლოდ გვარი მომწერე.':matches.slice(0,5).map(d=>d.firstName+' '+d.lastName+' — '+d.category+(d.specialty?' · '+d.specialty:'')+(ongoing.some(e=>e.id===d.electionId)?' (ხმის მიცემა გახსნილია)':' (ხმის მიცემა ჯერ დახურულია)')).join('\n')+'\nგახსენი /vote და აირჩიე მითითებული კატეგორია.';}}
 if(!answer){const sms=/(sms|სმს|კოდი|კოდს)/.test(q)||past.slice(0,2).some(p=>/(sms|სმს|კოდი|კოდს)/.test(p));if(sms&&/(არ მოვიდა|არ მოდის|ვერ მივიღ|არ მომსვლ)/.test(q)){name='ელენე';answer='გადაამოწმე ქართული მობილურის ნომერი (5XX XXX XXX), ქსელის სიგნალი და SMS-ების დაბლოკვა. ცოტა ხანში მოითხოვე ახალი კოდი. თუ კვლავ არ მოვა, მომწერე „მაინც არ მოვიდა“ და ოპერატორთან დაგაკავშირებ.';}else if(sms&&/(არასწორ|არ იღებ|არ მიიღ|ვადაგასულ)/.test(q)){name='ელენე';answer='გამოიყენე ყველაზე ბოლო SMS-ში მიღებული კოდი. ხმის მიცემის კოდი 10 წუთში იწურება; მოითხოვე ახალი და შეიყვანე შესაბამისი ექიმის არჩევისას. კოდი აქ არ დაწერო.';}else if(sms&&/(შეცდომ|ვერ იქმნ|ვერ შეიქმნ|მოთხოვნ)/.test(q)){name='ელენე';answer='გადაამოწმე ნომრის ფორმატი და არჩევნების მდგომარეობა. თუ მოთხოვნა ვერ სრულდება, მომწერე ეკრანზე ნაჩვენები შეცდომის ტექსტი, პირადი მონაცემებისა და კოდის გარეშე.';}else {const follow=/^(სად|როგორ|ეგ|ეს|კიდევ)[?!. ]*$/.test(q);answer=botAnswer(follow&&past.length?past[0]:q);if(/(sms|სმს|კოდი|კოდს)/.test(follow?past[0]||q:q))name='ელენე';else if(/(შედეგ|გამარჯვებულ)/.test(follow?past[0]||q:q))name='ნინო';}}
 return answer?{name,text:answer,escalate:false}:handoff();
}

