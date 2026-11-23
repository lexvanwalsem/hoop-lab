export type Tag = 'strength' | 'speed' | 'plyo' | 'rest' | 'test';

export interface Item {
  t: string; // short lead
  d: string; // explanation
  icon?: string; // see art.ts
  tag?: Tag; // only used by the week layout
}

export interface Section {
  title: string;
  intro?: string;
  items: Item[];
  layout: 'steps' | 'cards' | 'week';
}

export const filmingGuide: Section[] = [
  {
    title: 'Set up the camera',
    layout: 'steps',
    items: [
      { icon: 'camera', t: 'Fix the phone', d: 'Use a tripod or lean it on something solid. It must not move at all.' },
      { icon: 'film', t: 'Landscape or portrait', d: 'Either works. Keep the whole body in frame, feet to fingertips, including the top of the jump.' },
      { icon: 'ruler', t: 'Distance and height', d: 'Stand 4-5 m away with the camera at hip height. Fill at least half of the frame height with your body: a small figure makes joint angles noisy.' },
      { icon: 'target', t: 'Angle', d: 'Stand turned about 45 degrees to the camera. Fully sideways hides your far arm and leg from the tracker, and from the front your knee and elbow bend do not show. Jump height works from any angle.' },
      { icon: 'clock', t: 'Frame rate', d: 'Film at 60 fps or more (slo-mo at 120 or 240 fps is fine). The app reads the frame rate from the file by itself. At 30 fps the jump height is fine but shot timing is coarse (33 ms per frame).' },
      { icon: 'camera', t: 'iPhone', d: 'Settings, Camera, Record Video: choose 1080p HD at 60 fps. Do not edit and re-export the video at a lower frame rate.' },
      { icon: 'sun', t: 'Light and clothing', d: 'Good light, a plain background and fitted clothes that contrast with the background. Shoes visible.' },
      { icon: 'scale', t: 'Height and weight', d: 'Enter your real height and weight on the Analyze tab. Scale and power depend on them. Use the same camera spot every time so results are comparable.' },
    ],
  },
  {
    title: 'Standing jump',
    layout: 'steps',
    items: [
      { icon: 'user', t: 'Start still', d: 'Stand upright and still for 2 seconds, on one spot, feet shoulder-width apart. Do not walk towards the camera before or after: stay put and let the clip run.' },
      { icon: 'jump', t: 'Jump', d: 'Jump as high as you can with a countermovement and arm swing.' },
      { icon: 'landing', t: 'Land and reset', d: 'Land on the same spot, stand still a second. You can do several jumps in one clip, the app finds each one.' },
    ],
  },
  {
    title: 'Dunk approach jump',
    layout: 'steps',
    items: [
      { icon: 'camera', t: 'Camera', d: 'Far enough away (5-7 m) to keep the whole run and jump in frame, with the run-up crossing the picture at about 45 degrees.' },
      { icon: 'bolt', t: 'Run and jump', d: 'Stand still for 2 seconds at the start, then run up and jump as you would for a dunk.' },
      { icon: 'target', t: 'Rim', d: 'The rim is assumed to be 305 cm. It helps to have it in frame, but it is not needed.' },
      { icon: 'check', t: 'One attempt per video', d: 'Keep your whole body in frame until you have landed.' },
    ],
  },
  {
    title: 'Jump shot',
    layout: 'steps',
    items: [
      { icon: 'camera', t: 'Camera', d: '4-5 m away, turned about 45 degrees so your shooting arm is the one nearest to the camera. Include the ball path up to the top of the arc.' },
      { icon: 'ball', t: 'Take the shot', d: 'Stand still for 2 seconds, then shoot. Hold the follow-through until the ball lands. Several shots in one clip are fine, leave at least 2 seconds between them.' },
      { icon: 'target', t: 'Ball', d: 'A ball that contrasts with the background is tracked better. A clear ball gives an exact release and launch angle.' },
    ],
  },
];

export const jumpGuide: Section[] = [
  {
    title: 'What decides how high you jump',
    intro: 'Jump height comes from how fast you leave the floor. That speed is force multiplied by the time you can apply it, so you gain height from three levers.',
    layout: 'cards',
    items: [
      { icon: 'dumbbell', t: 'Strength', d: 'How much force your legs and hips can produce. This is the base: stronger muscles can push harder.' },
      { icon: 'bolt', t: 'Speed of force', d: 'How fast you can use that force in the short time you are on the ground (power).' },
      { icon: 'target', t: 'Technique', d: 'Timing, arm swing and using the elastic energy in your muscles and tendons, so you waste nothing.' },
    ],
  },
  {
    title: 'Technique: five cues',
    layout: 'steps',
    items: [
      { icon: 'user', t: 'Start tall and balanced', d: 'Feet about shoulder-width, weight on the whole foot, eyes forward.' },
      { icon: 'spring', t: 'Dip fast, no pause', d: 'Hips back, knees over the toes, down about a quarter to half squat (hips drop 25-50 cm), then straight up. Pausing at the bottom loses the stored elastic energy. The app measures depth and the time from the bottom of the dip to takeoff.' },
      { icon: 'arms', t: 'Use your arms', d: 'Swing the arms back during the dip, then drive them up hard as you push. Good arm swing typically adds around 10 percent to jump height.' },
      { icon: 'jump', t: 'Extend everything at once', d: 'Push through the whole foot and extend ankles, knees and hips together (triple extension). Leave the floor on your toes with a tall body.' },
      { icon: 'landing', t: 'Land soft on two feet', d: 'Bend ankles, knees and hips together as you land, knees over the toes. The app measures your landing knee angle.' },
    ],
  },
  {
    title: 'What to look at in your results',
    layout: 'cards',
    items: [
      { icon: 'trend', t: 'Jump height', d: 'For a standing jump the app uses flight time, the standard field method. The hip rise is shown as a second opinion, and they should be within about 10 cm.' },
      { icon: 'spring', t: 'Countermovement depth', d: 'Target 25-50 cm. Too shallow means little loading, too deep means a slow, inefficient dip.' },
      { icon: 'clock', t: 'Dip bottom to takeoff', d: 'Target 150-350 ms. A long time here means you are pausing and losing the stretch-reflex.' },
      { icon: 'landing', t: 'Landing knee angle', d: 'Under about 140 degrees means you absorb the landing. A stiff landing loads knees and back.' },
      { icon: 'bolt', t: 'Relative power', d: 'An estimate (Sayers formula) from your jump height and body weight. Around 55 W/kg or more is a good level. Use it to compare yourself over time, not as an exact measure.' },
    ],
  },
  {
    title: 'Training: three pillars',
    layout: 'cards',
    items: [
      { icon: 'dumbbell', t: 'Strength', d: 'Squat, trap-bar deadlift, split squat and Romanian deadlift. 2 sessions a week, 3-5 sets of 3-6 reps with a heavy but controlled weight and 2-3 minutes of rest.' },
      { icon: 'bolt', t: 'Power and plyometrics', d: 'Jump squats with a light load, box jumps (step down, do not jump down), broad jumps, depth jumps from 20-30 cm and pogo hops. 1-2 sessions a week, 3-5 sets of 3-5 reps with full rest. Stop a set when the quality drops.' },
      { icon: 'shield', t: 'Ankles, tendons and trunk', d: 'Calf raises with straight and bent knee (3 x 10-15), pogo hops, ankle and hip mobility, and planks or carries for a stiff trunk.' },
    ],
  },
  {
    title: 'Progress rules',
    layout: 'cards',
    items: [
      { icon: 'clock', t: 'Test the same way', d: 'Test rested, at the same time of day, with the same camera spot. Film every 1-2 weeks, not daily.' },
      { icon: 'trend', t: 'Build slowly', d: 'Add small amounts of load or reps. Every 4th week do a lighter week.' },
      { icon: 'moon', t: 'Recover', d: 'Sleep 7-9 hours and eat enough, including protein (roughly 1.4-2 g per kg body weight per day). Progress happens in recovery.' },
      { icon: 'trophy', t: 'Be patient', d: 'Real gains take weeks. If the number drops on a tired day, ignore it and look at the trend on the dashboard.' },
    ],
  },
  {
    title: 'A simple week',
    intro: 'Keep at least 48 hours between hard lower-body or jumping sessions.',
    layout: 'week',
    items: [
      { icon: 'dumbbell', tag: 'strength', t: 'Mon', d: 'Strength A: squat or trap-bar deadlift, split squat, calf raises. Then 3 x 4 box jumps.' },
      { icon: 'moon', tag: 'rest', t: 'Tue', d: 'Rest or easy sport, mobility.' },
      { icon: 'bolt', tag: 'speed', t: 'Wed', d: 'Speed: short sprints and light jump squats.' },
      { icon: 'dumbbell', tag: 'strength', t: 'Thu', d: 'Strength B: Romanian deadlift, step-ups, trunk work.' },
      { icon: 'moon', tag: 'rest', t: 'Fri', d: 'Rest.' },
      { icon: 'jump', tag: 'plyo', t: 'Sat', d: 'Plyometrics: depth jumps, broad jumps, pogo hops. Finish with a test jump and film it.' },
      { icon: 'moon', tag: 'rest', t: 'Sun', d: 'Rest.' },
    ],
  },
  {
    title: 'Dunk approach',
    layout: 'steps',
    items: [
      { icon: 'bolt', t: 'Build speed', d: 'Accelerate over 3-5 steps. The app measures your approach speed, aim for 4 m/s or more.' },
      { icon: 'spring', t: 'Long, low second-to-last step', d: 'Lower your hips on the second-to-last step, so you can convert speed into upward motion.' },
      { icon: 'landing', t: 'Short last step', d: 'Plant the last step quickly, heel to toe, and block with the front leg. Drive the arms and the lead knee up.' },
      { icon: 'target', t: 'Reach', d: 'Look at the rim and reach up with the whole arm. The app reports how far your hand is above the rim (target 10 cm or more).' },
      { icon: 'check', t: 'Practice both footings', d: 'Try one-foot and two-foot takeoffs and keep the one that gives you the most height.' },
    ],
  },
  {
    title: 'Stay safe',
    layout: 'cards',
    items: [
      { icon: 'sun', t: 'Warm up', d: 'At least 10 minutes: light cardio, ankle and hip mobility, a few easy jumps.' },
      { icon: 'trend', t: 'Progress gradually', d: 'Build up jump volume slowly. Start depth jumps only after some months of strength training and from a low height.' },
      { icon: 'shield', t: 'Listen to pain', d: 'Stop if you feel joint pain. This is general training information, not medical advice.' },
    ],
  },
];
