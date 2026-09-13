// Expanded Guess the Draw content: a larger word bank and extra stage-based drawings.
// Drawings are intentionally simple and readable so each stage adds a meaningful clue.

export const EXTRA_WORDS = [
  { answer: 'قمر', aliases: ['قمر'], difficulty: 'easy', clue: 'جرم سماوي كيبان فالليل.', draw: 'moon' },
  { answer: 'نجمة', aliases: ['نجمة', 'نجم'], difficulty: 'easy', clue: 'كتبان كنقطة مضوية فالسماء فالليل.', draw: 'star' },
  { answer: 'سحابة', aliases: ['سحابة', 'سحاب'], difficulty: 'easy', clue: 'كتبان فالسماء وكتقدر تجيب الشتا.', draw: 'cloud' },
  { answer: 'زهرة', aliases: ['زهرة', 'وردة'], difficulty: 'easy', clue: 'نبات ملون ورائحته ممكن تكون زوينة.', draw: 'flower' },
  { answer: 'كتاب', aliases: ['كتاب'], difficulty: 'easy', clue: 'حاجة كنقراو فيها القصص والمعلومات.', draw: 'book' },
  { answer: 'كأس', aliases: ['كاس', 'كأس'], difficulty: 'easy', clue: 'وعاء كنشربو فيه.', draw: 'cup' },
  { answer: 'مفتاح', aliases: ['مفتاح'], difficulty: 'easy', clue: 'شيء كنستعملوه باش نفتحو باب أو قفل.', draw: 'key' },
  { answer: 'شمسية', aliases: ['شمسية', 'مظلة'], difficulty: 'medium', clue: 'كتحمي من الشمس.', draw: 'umbrella' },
  { answer: 'نظارات', aliases: ['نظارات', 'نظارة'], difficulty: 'medium', clue: 'كتتحط قدام العينين.', draw: 'glasses' },
  { answer: 'هاتف', aliases: ['هاتف', 'تلفون', 'هاتف محمول'], difficulty: 'medium', clue: 'جهاز كنستعملوه للتواصل والتطبيقات.', draw: 'phone' },
  { answer: 'حاسبة', aliases: ['حاسبة', 'آلة حاسبة'], difficulty: 'medium', clue: 'جهاز صغير كيعاون فالحساب.', draw: 'calculator' },
  { answer: 'مروحة', aliases: ['مروحة'], difficulty: 'medium', clue: 'كتحرك الهواء باش تبرد المكان.', draw: 'fan' },
  { answer: 'مصباح', aliases: ['مصباح', 'لامبة', 'مصباح كهربائي'], difficulty: 'medium', clue: 'كيعطي الضوء.', draw: 'lamp' },
  { answer: 'مظروف', aliases: ['مظروف', 'ظرف'], difficulty: 'medium', clue: 'كيستعمل لإرسال رسالة أو وثيقة.', draw: 'envelope' },
  { answer: 'مطرقة', aliases: ['مطرقة'], difficulty: 'medium', clue: 'أداة كتستعمل لضرب المسامير.', draw: 'hammer' },
  { answer: 'مقص', aliases: ['مقص'], difficulty: 'medium', clue: 'أداة فيها جوج شفرات للقطع.', draw: 'scissors' },
  { answer: 'مظلة شاطئية', aliases: ['مظلة شاطئية', 'شمسية شاطئية'], difficulty: 'hard', clue: 'كتلقاها غالباً فوق الشاطئ.', draw: 'beachUmbrella' },
  { answer: 'بالون', aliases: ['بالون'], difficulty: 'hard', clue: 'حاجة كتنتفخ بالهواء وكتستعمل فالاحتفالات.', draw: 'balloon' },
  { answer: 'هدية', aliases: ['هدية', 'علبة هدية'], difficulty: 'hard', clue: 'شيء كيتعطى لشخص فمناسبة.', draw: 'gift' },
  { answer: 'كرة سلة', aliases: ['كرة سلة', 'باسكيط'], difficulty: 'hard', clue: 'كرة كتستعمل فرياضة كتدخل للسلة.', draw: 'basketball' },
  { answer: 'مرمى', aliases: ['مرمى', 'هدف'], difficulty: 'hard', clue: 'اللاعبون كيحاولو يدخلو فيه الكرة فبعض الرياضات.', draw: 'goal' },
  { answer: 'سماعة', aliases: ['سماعة', 'سماعات'], difficulty: 'hard', clue: 'كنستعملوها لسماع الصوت.', draw: 'headphones' },
  { answer: 'لوحة', aliases: ['لوحة', 'تابلت'], difficulty: 'hard', clue: 'جهاز بشاشة كبيرة نسبياً ويمكن نتحكمو فيه باللمس.', draw: 'tablet' },
  { answer: 'روبوت', aliases: ['روبوت'], difficulty: 'hard', clue: 'آلة كتقدر تنفذ مهام بطريقة مبرمجة.', draw: 'robot' },
  { answer: 'سفينة', aliases: ['سفينة', 'باخرة'], difficulty: 'hard', clue: 'وسيلة نقل كتسافر فوق الماء.', draw: 'ship' },
  { answer: 'جسر', aliases: ['جسر', 'قنطرة'], difficulty: 'hard', clue: 'بنية كتربط بين جوج جهات فوق طريق أو نهر.', draw: 'bridge' },
  { answer: 'دراجة', aliases: ['دراجة', 'بيكالة', 'دراجة هوائية'], difficulty: 'hard', clue: 'وسيلة نقل بعجلتين كتتحرك بالدواسات.', draw: 'bicycle' },
  { answer: 'ثلج', aliases: ['ثلج', 'جليد'], difficulty: 'hard', clue: 'ماء متجمد وكيبان فالجو البارد.', draw: 'snowman' },
  { answer: 'ثلّاجة', aliases: ['ثلاجة', 'ثلّاجة'], difficulty: 'hard', clue: 'جهاز كيحافظ على المأكولات باردة.', draw: 'fridge' },
  { answer: 'مغناطيس', aliases: ['مغناطيس'], difficulty: 'hard', clue: 'شيء كيقدر يجذب بعض المعادن.', draw: 'magnet' },
  { answer: 'بوصلة', aliases: ['بوصلة'], difficulty: 'hard', clue: 'أداة كتعاونك تعرف الاتجاهات.', draw: 'compass' },
  { answer: 'تلسكوب', aliases: ['تلسكوب', 'منظار فلكي'], difficulty: 'hard', clue: 'جهاز كنشوفو به أشياء بعيدة فالسماء.', draw: 'telescope' },
  { answer: 'بركان', aliases: ['بركان'], difficulty: 'hard', clue: 'جبل أو فتحة كتخرج منها مواد حارة أحياناً.', draw: 'volcano' },
];

function circle(ctx, x, y, r, fill = null, stroke = '#263238', width = 8) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, x1, y1, x2, y2, width = 8) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = width; ctx.stroke();
}
function rect(ctx, x, y, w, h, fill = null, stroke = '#263238', width = 8) {
  ctx.beginPath(); ctx.rect(x, y, w, h);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function base(ctx, frame) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (frame >= 5) line(ctx, 80, 410, 680, 410, 6);
}

export const EXTRA_DRAWERS = {
  moon(ctx, frame) {
    base(ctx, frame); circle(ctx, 380, 220, frame >= 2 ? 105 : 65, '#fff3c4', '#8d6e63', 8);
    if (frame >= 3) circle(ctx, 420, 190, 88, '#f7f3ea', null, 0);
    if (frame >= 4) { circle(ctx, 345, 190, 12, '#d7ccc8', null, 0); circle(ctx, 405, 250, 15, '#d7ccc8', null, 0); }
    if (frame >= 5) { circle(ctx, 145, 105, 5, '#263238', null, 0); circle(ctx, 620, 110, 5, '#263238', null, 0); }
  },
  star(ctx, frame) {
    base(ctx, frame); const cx = 380, cy = 225, r = frame >= 2 ? 120 : 70;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * .45 : r; const x = cx + Math.cos(a) * rr; const y = cy + Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fillStyle = '#ffd54f'; ctx.fill(); ctx.strokeStyle = '#f57f17'; ctx.lineWidth = 8; ctx.stroke();
    if (frame >= 4) { circle(ctx, 145, 120, 4, '#263238', null, 0); circle(ctx, 620, 150, 4, '#263238', null, 0); }
  },
  cloud(ctx, frame) {
    base(ctx, frame);
    if (frame >= 1) { circle(ctx, 320, 235, 70, '#e3f2fd', '#607d8b', 7); circle(ctx, 390, 205, 90, '#e3f2fd', '#607d8b', 7); circle(ctx, 470, 240, 65, '#e3f2fd', '#607d8b', 7); rect(ctx, 300, 235, 190, 80, '#e3f2fd', '#607d8b', 7); }
    if (frame >= 3) for (const x of [290, 360, 430, 500]) line(ctx, x, 330, x - 10, 365, 5);
    if (frame >= 5) line(ctx, 610, 150, 625, 135, 5);
  },
  flower(ctx, frame) {
    base(ctx, frame); line(ctx, 380, 250, 380, 395, 8);
    if (frame >= 1) circle(ctx, 380, 190, 42, '#f48fb1', '#ad1457', 7);
    if (frame >= 2) { circle(ctx, 330, 190, 42, '#f48fb1', '#ad1457', 7); circle(ctx, 430, 190, 42, '#f48fb1', '#ad1457', 7); }
    if (frame >= 3) { circle(ctx, 380, 140, 42, '#f48fb1', '#ad1457', 7); circle(ctx, 380, 240, 42, '#f48fb1', '#ad1457', 7); circle(ctx, 380, 190, 24, '#ffd54f', '#f9a825', 6); }
    if (frame >= 4) { line(ctx, 380, 315, 320, 285, 6); line(ctx, 380, 345, 440, 315, 6); }
  },
  book(ctx, frame) {
    base(ctx, frame); rect(ctx, 235, 145, 300, 240, '#90caf9', '#1565c0', 8);
    if (frame >= 2) line(ctx, 385, 150, 385, 380, 6);
    if (frame >= 3) { line(ctx, 270, 205, 345, 205, 5); line(ctx, 270, 230, 345, 230, 5); line(ctx, 420, 205, 495, 205, 5); line(ctx, 420, 230, 495, 230, 5); }
    if (frame >= 4) { line(ctx, 270, 285, 340, 285, 5); line(ctx, 430, 285, 495, 285, 5); }
    if (frame >= 5) circle(ctx, 600, 110, 5, '#263238', null, 0);
  },
  cup(ctx, frame) {
    base(ctx, frame); rect(ctx, 285, 175, 190, 190, '#ffe0b2', '#6d4c41', 8);
    if (frame >= 2) { ctx.beginPath(); ctx.arc(490, 245, 65, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 8; ctx.stroke(); }
    if (frame >= 3) { line(ctx, 315, 145, 440, 145, 6); line(ctx, 330, 115, 430, 115, 6); }
    if (frame >= 5) { circle(ctx, 320, 325, 6, '#90caf9', null, 0); circle(ctx, 445, 325, 6, '#90caf9', null, 0); }
  },
  key(ctx, frame) {
    base(ctx, frame); circle(ctx, 300, 235, 55, '#ffd54f', '#8d6e63', 8); line(ctx, 350, 235, 560, 235, 10);
    if (frame >= 2) { line(ctx, 470, 235, 470, 285, 9); line(ctx, 515, 235, 515, 275, 9); }
    if (frame >= 3) { rect(ctx, 260, 195, 75, 80, null, '#8d6e63', 5); }
    if (frame >= 4) { line(ctx, 570, 205, 625, 205, 5); line(ctx, 595, 180, 595, 230, 5); }
  },
  glasses(ctx, frame) {
    base(ctx, frame); circle(ctx, 320, 230, 70, '#e3f2fd', '#1565c0', 8); circle(ctx, 440, 230, 70, '#e3f2fd', '#1565c0', 8); line(ctx, 390, 230, 410, 230, 8);
    if (frame >= 2) { line(ctx, 250, 205, 205, 180, 7); line(ctx, 510, 205, 555, 180, 7); }
    if (frame >= 4) { line(ctx, 290, 300, 330, 300, 5); line(ctx, 430, 300, 470, 300, 5); }
  },
  phone(ctx, frame) {
    base(ctx, frame); rect(ctx, 275, 100, 210, 305, '#263238', '#111827', 10);
    if (frame >= 2) rect(ctx, 295, 135, 170, 220, '#90caf9', '#1565c0', 6);
    if (frame >= 3) { circle(ctx, 325, 170, 8, '#ef5350', null, 0); circle(ctx, 350, 170, 8, '#ffd54f', null, 0); line(ctx, 320, 220, 440, 220, 5); }
    if (frame >= 4) circle(ctx, 380, 380, 12, '#eceff1', null, 0);
  },
  calculator(ctx, frame) {
    base(ctx, frame); rect(ctx, 265, 100, 230, 300, '#b0bec5', '#455a64', 8);
    if (frame >= 2) rect(ctx, 295, 130, 170, 70, '#e8f5e9', '#2e7d32', 6);
    if (frame >= 3) for (const [x, y] of [[305,235],[370,235],[435,235],[305,295],[370,295],[435,295]]) circle(ctx, x, y, 20, '#eceff1', '#607d8b', 5);
    if (frame >= 5) line(ctx, 325, 165, 435, 165, 5);
  },
  fan(ctx, frame) {
    base(ctx, frame); line(ctx, 380, 300, 380, 395, 9); circle(ctx, 380, 235, 115, '#eceff1', '#607d8b', 7);
    if (frame >= 2) { for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3; line(ctx, 380, 235, 380 + Math.cos(a) * 95, 235 + Math.sin(a) * 95, 13); } }
    if (frame >= 4) circle(ctx, 380, 235, 18, '#90a4ae', '#455a64', 5);
  },
  lamp(ctx, frame) {
    base(ctx, frame); line(ctx, 380, 145, 380, 335, 10); ctx.beginPath(); ctx.moveTo(290, 335); ctx.lineTo(470, 335); ctx.lineTo(430, 230); ctx.lineTo(330, 230); ctx.closePath(); ctx.fillStyle = '#fff59d'; ctx.fill(); ctx.strokeStyle = '#f9a825'; ctx.lineWidth = 8; ctx.stroke();
    if (frame >= 3) { circle(ctx, 380, 395, 8, '#263238', null, 0); }
  },
  envelope(ctx, frame) {
    base(ctx, frame); rect(ctx, 220, 185, 320, 205, '#ffffff', '#455a64', 8);
    if (frame >= 2) { ctx.beginPath(); ctx.moveTo(225, 190); ctx.lineTo(380, 305); ctx.lineTo(535, 190); ctx.strokeStyle = '#455a64'; ctx.stroke(); }
    if (frame >= 4) { line(ctx, 225, 385, 335, 290, 6); line(ctx, 535, 385, 425, 290, 6); }
  },
  hammer(ctx, frame) {
    base(ctx, frame); line(ctx, 350, 315, 520, 145, 20); rect(ctx, 240, 110, 230, 85, '#90a4ae', '#455a64', 8);
    if (frame >= 3) { line(ctx, 300, 200, 260, 330, 8); line(ctx, 260, 330, 225, 330, 8); }
    if (frame >= 5) { line(ctx, 560, 120, 610, 90, 5); line(ctx, 585, 150, 640, 140, 5); }
  },
  scissors(ctx, frame) {
    base(ctx, frame); circle(ctx, 300, 300, 55, '#e3f2fd', '#1565c0', 8); circle(ctx, 460, 300, 55, '#e3f2fd', '#1565c0', 8); line(ctx, 335, 270, 455, 155, 10); line(ctx, 425, 270, 300, 150, 10);
    if (frame >= 4) { line(ctx, 455, 155, 560, 100, 6); line(ctx, 300, 150, 205, 100, 6); }
  },
  beachUmbrella(ctx, frame) {
    base(ctx, frame); ctx.beginPath(); ctx.arc(380, 230, 155, Math.PI, 0); ctx.lineTo(535, 230); ctx.closePath(); ctx.fillStyle = '#ef9a9a'; ctx.fill(); ctx.strokeStyle = '#ad1457'; ctx.lineWidth = 8; ctx.stroke();
    if (frame >= 2) line(ctx, 380, 230, 380, 390, 9); if (frame >= 3) { circle(ctx, 170, 340, 55, '#ffe082', '#ef6c00', 7); line(ctx, 100, 410, 650, 410, 7); }
    if (frame >= 5) { circle(ctx, 590, 155, 28, '#ffd54f', '#f9a825', 5); }
  },
  balloon(ctx, frame) {
    base(ctx, frame); circle(ctx, 380, 220, 115, '#ef5350', '#b71c1c', 8); line(ctx, 380, 335, 380, 405, 5); ctx.beginPath(); ctx.moveTo(365, 325); ctx.lineTo(380, 345); ctx.lineTo(395, 325); ctx.closePath(); ctx.fillStyle = '#ef5350'; ctx.fill();
    if (frame >= 4) { line(ctx, 210, 140, 245, 110, 5); line(ctx, 550, 140, 585, 110, 5); }
  },
  gift(ctx, frame) {
    base(ctx, frame); rect(ctx, 240, 210, 280, 180, '#90caf9', '#1565c0', 8); line(ctx, 380, 210, 380, 390, 8); if (frame >= 2) line(ctx, 240, 265, 520, 265, 8);
    if (frame >= 3) { circle(ctx, 350, 180, 35, '#ef9a9a', '#ad1457', 7); circle(ctx, 410, 180, 35, '#ef9a9a', '#ad1457', 7); }
    if (frame >= 5) line(ctx, 200, 410, 560, 410, 6);
  },
  basketball(ctx, frame) {
    base(ctx, frame); circle(ctx, 380, 245, frame >= 2 ? 110 : 75, '#ffb74d', '#e65100', 9);
    if (frame >= 3) { ctx.beginPath(); ctx.arc(380, 245, 110, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(380, 245, 110, Math.PI, Math.PI * 2); ctx.stroke(); line(ctx, 270, 245, 490, 245, 6); }
    if (frame >= 5) { rect(ctx, 570, 160, 55, 170, null, '#8d6e63', 7); line(ctx, 545, 170, 650, 170, 7); }
  },
  goal(ctx, frame) {
    base(ctx, frame); line(ctx, 235, 360, 235, 170, 8); line(ctx, 525, 360, 525, 170, 8); line(ctx, 235, 170, 525, 170, 8);
    if (frame >= 2) { for (let x = 255; x <= 505; x += 35) line(ctx, x, 175, x - 20, 350, 3); for (let x = 260; x <= 505; x += 50) line(ctx, x, 350, x + 35, 175, 3); }
    if (frame >= 4) circle(ctx, 380, 300, 48, '#ffffff', '#263238', 7);
  },
  headphones(ctx, frame) {
    base(ctx, frame); ctx.beginPath(); ctx.arc(380, 245, 125, Math.PI, 0); ctx.strokeStyle = '#455a64'; ctx.lineWidth = 18; ctx.stroke(); rect(ctx, 235, 235, 55, 125, '#90a4ae', '#455a64', 8); rect(ctx, 470, 235, 55, 125, '#90a4ae', '#455a64', 8);
    if (frame >= 4) { line(ctx, 305, 115, 455, 115, 7); }
  },
  tablet(ctx, frame) {
    base(ctx, frame); rect(ctx, 240, 100, 280, 300, '#263238', '#111827', 10); if (frame >= 2) rect(ctx, 265, 130, 230, 220, '#90caf9', '#1565c0', 6); if (frame >= 4) circle(ctx, 380, 375, 10, '#eceff1', null, 0);
  },
  robot(ctx, frame) {
    base(ctx, frame); rect(ctx, 300, 150, 160, 145, '#b0bec5', '#455a64', 8); if (frame >= 2) { circle(ctx, 345, 210, 12, '#263238', null, 0); circle(ctx, 415, 210, 12, '#263238', null, 0); line(ctx, 350, 255, 410, 255, 6); }
    if (frame >= 3) { rect(ctx, 275, 305, 210, 90, '#90a4ae', '#455a64', 8); line(ctx, 380, 110, 380, 150, 7); circle(ctx, 380, 95, 10, '#ef5350', '#b71c1c', 5); }
    if (frame >= 4) { line(ctx, 275, 330, 220, 290, 7); line(ctx, 485, 330, 540, 290, 7); }
  },
  ship(ctx, frame) {
    base(ctx, frame); ctx.beginPath(); ctx.moveTo(190, 300); ctx.lineTo(560, 300); ctx.lineTo(500, 380); ctx.lineTo(250, 380); ctx.closePath(); ctx.fillStyle = '#90caf9'; ctx.fill(); ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 8; ctx.stroke();
    if (frame >= 2) { rect(ctx, 290, 180, 160, 120, '#eceff1', '#455a64', 7); line(ctx, 370, 100, 370, 180, 8); }
    if (frame >= 4) { line(ctx, 370, 105, 445, 145, 6); circle(ctx, 155, 325, 25, '#90caf9', '#1565c0', 5); }
  },
  bridge(ctx, frame) {
    base(ctx, frame); line(ctx, 140, 360, 620, 360, 10); if (frame >= 2) { line(ctx, 210, 160, 210, 360, 10); line(ctx, 550, 160, 550, 360, 10); }
    if (frame >= 3) { ctx.beginPath(); ctx.moveTo(210, 160); ctx.quadraticCurveTo(380, 100, 550, 160); ctx.stroke(); }
    if (frame >= 4) for (let x = 240; x < 540; x += 45) line(ctx, x, 150, x, 360, 4);
    if (frame >= 5) { ctx.fillStyle = '#90caf9'; ctx.fillRect(150, 365, 460, 45); }
  },
  bicycle(ctx, frame) {
    base(ctx, frame); circle(ctx, 270, 330, 70, null, '#263238', 8); circle(ctx, 490, 330, 70, null, '#263238', 8); line(ctx, 270, 330, 365, 260, 7); line(ctx, 365, 260, 490, 330, 7); line(ctx, 270, 330, 490, 330, 7); if (frame >= 3) { line(ctx, 365, 260, 345, 210, 7); line(ctx, 345, 210, 395, 210, 7); } if (frame >= 5) line(ctx, 410, 255, 460, 220, 6);
  },
  snowman(ctx, frame) {
    base(ctx, frame); circle(ctx, 380, 300, 95, '#ffffff', '#90a4ae', 7); if (frame >= 2) circle(ctx, 380, 180, 70, '#ffffff', '#90a4ae', 7); if (frame >= 3) { circle(ctx, 355, 165, 7, '#263238', null, 0); circle(ctx, 405, 165, 7, '#263238', null, 0); line(ctx, 380, 180, 420, 190, 5); } if (frame >= 4) { rect(ctx, 330, 80, 100, 35, '#263238', '#111827', 5); line(ctx, 335, 115, 425, 115, 8); } if (frame >= 5) { line(ctx, 300, 260, 220, 210, 6); line(ctx, 460, 260, 540, 210, 6); }
  },
  fridge(ctx, frame) {
    base(ctx, frame); rect(ctx, 280, 100, 210, 300, '#eceff1', '#455a64', 8); line(ctx, 285, 230, 485, 230, 5); if (frame >= 2) { line(ctx, 450, 150, 450, 205, 8); line(ctx, 450, 270, 450, 350, 8); } if (frame >= 4) { circle(ctx, 330, 330, 18, '#ef5350', '#b71c1c', 5); circle(ctx, 390, 330, 18, '#66bb6a', '#2e7d32', 5); }
  },
  magnet(ctx, frame) { base(ctx, frame); ctx.beginPath(); ctx.arc(380, 235, 100, 0, Math.PI); ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 30; ctx.stroke(); line(ctx, 280, 235, 280, 150, 30); line(ctx, 480, 235, 480, 150, 30); if (frame >= 3) { circle(ctx, 320, 340, 15, '#90a4ae', '#455a64', 5); circle(ctx, 440, 340, 15, '#90a4ae', '#455a64', 5); } },
  compass(ctx, frame) { base(ctx, frame); circle(ctx, 380, 245, 125, '#fffde7', '#5d4037', 8); if (frame >= 2) { line(ctx, 380, 140, 380, 350, 4); line(ctx, 275, 245, 485, 245, 4); } if (frame >= 3) { ctx.beginPath(); ctx.moveTo(380, 150); ctx.lineTo(410, 250); ctx.lineTo(380, 340); ctx.lineTo(350, 250); ctx.closePath(); ctx.fillStyle = '#ef5350'; ctx.fill(); ctx.stroke(); } if (frame >= 5) { line(ctx, 380, 105, 380, 80, 6); } },
  telescope(ctx, frame) { base(ctx, frame); line(ctx, 270, 330, 470, 170, 28); circle(ctx, 470, 170, 30, '#90caf9', '#1565c0', 7); line(ctx, 340, 270, 300, 390, 8); line(ctx, 440, 190, 500, 390, 8); if (frame >= 4) { circle(ctx, 600, 120, 45, '#fff3c4', '#8d6e63', 6); } },
  volcano(ctx, frame) { base(ctx, frame); ctx.beginPath(); ctx.moveTo(180, 390); ctx.lineTo(310, 190); ctx.lineTo(380, 230); ctx.lineTo(450, 185); ctx.lineTo(580, 390); ctx.closePath(); ctx.fillStyle = '#8d6e63'; ctx.fill(); ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 8; ctx.stroke(); if (frame >= 2) { ctx.beginPath(); ctx.moveTo(335, 195); ctx.lineTo(380, 235); ctx.lineTo(425, 190); ctx.strokeStyle = '#ef5350'; ctx.stroke(); } if (frame >= 3) line(ctx, 380, 195, 380, 110, 9); if (frame >= 5) { circle(ctx, 360, 90, 24, '#cfd8dc', null, 0); circle(ctx, 410, 90, 20, '#cfd8dc', null, 0); } },
};
