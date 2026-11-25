// Daily kick-in-the-ass quotes (harsh on purpose, the owner asked for it: English only, swearing and
// body/self-esteem roasts allowed). Picked by date, so it's free, needs no AI, and rotates: a different
// one every day, and none repeats until the whole list has been shown.

export const KUTIPAN: string[] = [
  "Wake up, motherfucker. The barbell isn't going to lift itself.",
  "You're tired? Cool story. You're still skinny and you're still not lifting. Move.",
  "Your excuses are like your biceps: tiny, weak, and nobody's impressed.",
  "Don't be weak, you fucking noodle. 75 kg doesn't build itself.",
  "That bed is comfortable, and that's exactly why you still look like last month's version of yourself.",
  "You want a six-pack but you're lying on the couch? Get the fuck up.",
  "Nobody gives a shit that you're tired. The iron doesn't either.",
  "Today you either sweat or you regret. Pick one, coward.",
  "Motivation is bullshit. Discipline is waking up, showing up, and lifting. Now move.",
  "You don't lack time. You lack self-respect.",
  "Two hours of scrolling, but you can't spare sixty minutes for your own body? Pathetic.",
  "Yesterday you said tomorrow. Well, dumbass, it's tomorrow.",
  "Weak people wait for motivation. Strong people show up pissed off and tired.",
  "18 kg today, 20 next week. Unless you'd rather be the coward who skips.",
  "The gym is empty because everyone is as lazy as you are right now. Don't join them.",
  "You're not tired, you're scared of discomfort. The pain is brief. The regret is forever.",
  "Every time you skip, someone else is doing their fourth set and walking past you.",
  "Stop negotiating with yourself. You never win an argument against your own bed.",
  "You bust your ass at work for your boss. Bust it a little for your own body.",
  "Be a savage, not a snacker. Put the phone down and pick up the iron.",
  "Want your girlfriend proud of you? Lying around all day won't do it, bro.",
  "One hour is 4% of your day. You're going to lose to 4%? Embarrassing.",
  "Eid is coming. Still want to look like a coat hanger? Get the fuck under the bar.",
  "Nobody is born strong. They just stopped talking and started lifting.",
  "Pain from discipline is temporary. Pain from regret lasts forever.",
  "You don't need pre-workout. You need a spine.",
  "Get your lazy ass up. Every excuse you've got gets paid off at the dumbbell rack.",
  "Late beats never. Get going now, you procrastinating bastard.",
  "Progress doesn't come from intentions. It comes from the sets you finish when you want to bail.",
  "If it were easy everyone would be jacked. So be more stubborn than them.",
  "One skipped session becomes two, two becomes a week. Break the chain today, you slacker.",
  "Don't just count the reps, make them count. And quit whining while you lift.",
  "You've complained for five minutes. In five minutes you could've finished a whole set.",
  "Your body responds to what you feed it. Feed it iron, not excuses.",
  "Weight doesn't go up on its own. Eat, lift, repeat. Stop being picky and eat.",
  "Don't be the guy who 'used to be consistent'.",
  "You're not a victim of circumstances. You're a victim of your own laziness, and you can fight that right now.",
  "Morning or night, I don't care. But 'not today' is not an option.",
  "Hard work beats talent when talent doesn't work hard. Why are you still reading this? Go.",
  "What hurts isn't 20 kg on the bar. What hurts is looking exactly the same a year from now.",
  "Tired is a feeling. Skipping is a record. Which one do you want in your logbook?",
  "Stop checking progress in the mirror. Check the logbook. Yours is empty today.",
  "If you can still type this, you can still lift.",
  "Nobody's coming to save you. Pick up the weight yourself.",
  "You don't need to feel ready. You need to start. First set, right now.",
  "Losers say 'tomorrow'. Winners are already at the dumbbell rack.",
  "Consistency is boring, which is why so few people have results. Be boring.",
  "You already know what to do. The only thing missing is doing it, you fuck.",
  "I don't give a shit if you're not in the mood. Mood doesn't build muscle.",
  "Whining burns zero calories. The treadmill burns some. Twenty minutes.",
  "You're not weak. You're just not pissed off enough about how you look right now.",
  "You said you wanted 75 kg. The scale doesn't read your intentions, only your food and your iron.",
  "Start with one set. The rest usually follows. Get there first, cut the drama.",
  "Weak men skip. Strong men show up when it sucks.",
  "Post-workout soreness is proof. Skipping guilt is regret. Pick proof.",
  "The body you want is in there, buried under your excuses. Dig it out, set by set.",
  "What are you paying the gym for, decoration? Use it, you idiot.",
  "Your only opponent is who you were yesterday. Beat that bitch today.",
  "Don't stop when you're tired. Stop when you're done. And you're not fucking done.",
  "Your laziness is a coward. Don't give it a seat in your head.",
  "Those arms aren't 'lean', they're unemployed. Put them to work.",
  "Skinny-fat is not a personality. Lift, eat, and fix it.",
  "Your shirt doesn't hang off you because of style. It hangs because there's nothing underneath. Fill it.",
  "Soft body, soft excuses. Harden both.",
  "You look like a before picture. Go earn the after.",
  "Pencil arms don't turn into anything on their own. Feed them and make them work.",
  "Your self-respect is skipping the gym harder than you are. Go get it back.",
  "You call it 'taking it easy'. Everyone else calls it getting left behind.",
  "Being average is free. Being jacked costs you the comfort you're hugging right now. Pay up.",
];

/** After a finished workout: a short acknowledgement, same attitude. */
export const KUTIPAN_SELESAI: string[] = [
  "About fucking time. Good job, now go eat your protein.",
  "Done. You beat the lazy version of yourself today.",
  "Respect. Do it again tomorrow, and don't get cocky.",
  "That's more like it. Eat right, sleep enough.",
  "One more deposit in the discipline bank. Keep saving.",
  "Sweat paid in full. Don't forget the protein.",
  "Not bad, you scrawny bastard. Go refuel and rest.",
  "While everyone else was thinking about it, you did it. That's the whole difference.",
];

function hariKe(tanggal: string): number {
  return Math.round(Date.UTC(+tanggal.slice(0, 4), +tanggal.slice(5, 7) - 1, +tanggal.slice(8, 10)) / 86_400_000);
}

function fpb(a: number, b: number): number {
  return b === 0 ? a : fpb(b, a % b);
}

/**
 * Pick a quote for the date "YYYY-MM-DD": jump by a step that is coprime with the list length, so every
 * quote appears once before anything repeats and consecutive days always differ.
 */
export function kutipanUntuk(tanggal: string, daftar: string[] = KUTIPAN): string {
  const n = daftar.length;
  if (n === 0) return "";
  let langkah = Math.max(1, Math.floor(n / 3));
  while (fpb(langkah, n) !== 1) langkah++;
  const idx = (((hariKe(tanggal) * langkah) % n) + n) % n;
  return daftar[idx];
}

export const kutipanHariIni = (tanggal: string) => kutipanUntuk(tanggal, KUTIPAN);
export const kutipanSelesai = (tanggal: string) => kutipanUntuk(tanggal, KUTIPAN_SELESAI);
