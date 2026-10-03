export function botAnswer(question:string):string|null{
 const q=question.trim().toLowerCase();
 if(/^(გამარჯობა|სალამი|გამარჯობათ|hello|hi|gamarjoba|salam)([!?. ,].*)?$/.test(q))return "გამარჯობა! მიხარია შენი ნახვა 💙 რით შემიძლია დაგეხმარო MedFriend-ზე?";
 if(/^(მადლობა|გმადლობ|thanks|thank you|madloba)/.test(q))return "სიამოვნებით! 💙 თუ სხვა კითხვა აღარ გაქვს, დაასრულე საუბარი და შეაფასე დახმარება.";
 if(/(sms|სმს|კოდი|კოდს)/.test(q))return "გადაამოწმე მობილურის ნომერი — უნდა იყოს ქართული ნომერი 5XX XXX XXX. დაელოდე SMS-ს და საჭიროების შემთხვევაში გამოიყენე „ახალი კოდის მიღება“. კოდი არავის გაუზიარო. თუ პრობლემა გაგრძელდა, დააჭირე „გუნდთან დაკავშირება“.";
 if(/(შედეგ|გამარჯვებულ)/.test(q))return "გახსენი „გამარჯვებულები“. შედეგები გამოჩნდება მხოლოდ ადმინისტრაციის ოფიციალური დადასტურების შემდეგ. წინა არჩევნების შედეგები შეგიძლია არქივის არჩევანით ნახო.";
 if(/(ხმა|ხმას|მივცე|კატეგორი)/.test(q))return "გახსენი „ხმის მიცემა“, აირჩიე კატეგორია და ექიმი, შემდეგ მიუთითე მობილური და შეიყვანე SMS კოდი. ერთ ნომერს თითოეულ კატეგორიაში ერთი ხმის მიცემა შეუძლია. ხმის მიცემა ხელმისაწვდომია არჩევნების მიმდინარეობისას.";
 return null;
}

export function botResponse(question:string,history:string[]=[]){
 const q=question.toLowerCase();
 const human=/(ოპერატორ|ადამიანთან|სუპორტ|support|operator|human|operatori)/.test(q);
 const unresolved=/(არ (მუშაობ|შვება|მოვიდა|დამეხმარ|გამოვიდა)|ვერ (შევ|ვაკეთ|მივიღ)|მაინც|არასწორ)/.test(q)&&history.length>0;
 const contextual=/(კიდევ|ეგ|ეს|როგორ|სად)/.test(q)&&q.length<35&&history.length>0?question+' '+history[0]:question;
 const answer=human||unresolved?null:botAnswer(contextual);
 const name=/(sms|სმს|კოდი|კოდს)/.test(contextual)?'ელენე':/(შედეგ|გამარჯვებულ)/.test(contextual)?'ნინო':'ნია';
 return {name,text:answer||(human?'ოპერატორთან დაკავშირების მოთხოვნა მიღებულია. ჩვენი გუნდი ამ მიმოწერაში გიპასუხებს. 💙':'ზუსტი პასუხისთვის ოპერატორის დახმარება გვჭირდება. საუბრის ისტორია გუნდს გადავეცი — პასუხს აქ მიიღებ. 💙'),escalate:!answer};
}

