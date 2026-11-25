/**
 * Exercises people can do, grouped by what they train. One tap logs the suggested sets and reps.
 * The numbers follow common strength and conditioning practice: strength in low reps with a load you control,
 * jumps in low volume with full rest, shooting in many clean repetitions. It is general guidance, not medical advice.
 */

export type Group = 'strength' | 'jumps' | 'shooting';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Exercise {
  name: string;
  group: Group;
  level: Level;
  sets: number;
  reps: number;
  per?: string; // "per side" when the reps are for each leg
  why: string;
  cues: string[];
}

export const GROUP_LABEL: Record<Group, string> = { strength: 'Strength', jumps: 'Jumps', shooting: 'Shooting' };

export const GROUP_NOTE: Record<Group, string> = {
  strength: 'Strength is the base. Use a load you can control for every rep, rest 2 to 3 minutes, and add weight slowly.',
  jumps: 'Jumps are hard on tendons. While you build up, keep to about 80 to 100 foot contacts per session, 1 or 2 sessions a week with 48 hours in between. Rest fully between sets and stop when it hurts.',
  shooting: 'Shooting is repetition with good form. Slow and clean beats fast and sloppy. Count only the shots with the right form.',
};

export const EXERCISES: Exercise[] = [
  // ----- strength -----
  { name: 'Back squat', group: 'strength', level: 'Intermediate', sets: 3, reps: 5, why: 'Builds the force your jump is made of.', cues: ['Feet about shoulder-width, toes slightly out.', 'Brace your core, hips back and down to at least parallel.', 'Drive up through the whole foot, heels down.', 'Start light and learn the movement first.'] },
  { name: 'Trap-bar deadlift', group: 'strength', level: 'Intermediate', sets: 3, reps: 5, why: 'Strong legs and hips with less strain on the lower back than a straight bar.', cues: ['Stand in the middle of the bar, grip the handles.', 'Chest up, back flat, push the floor away.', 'Stand tall at the top, do not lean back.', 'Lower under control.'] },
  { name: 'Romanian deadlift', group: 'strength', level: 'Beginner', sets: 3, reps: 8, why: 'Strengthens the hamstrings and glutes that power the takeoff.', cues: ['Soft knees, push the hips back.', 'Keep the weight close to your legs, back flat.', 'Go down until you feel the hamstrings stretch.', 'Squeeze the glutes to stand up.'] },
  { name: 'Split squat', group: 'strength', level: 'Beginner', sets: 3, reps: 8, per: 'per side', why: 'One leg at a time: strength, balance and the same demand as a takeoff.', cues: ['Long step forward, back foot behind you.', 'Lower straight down, front knee over the toes.', 'Push up through the front heel.', 'Hold something for balance at first.'] },
  { name: 'Calf raise', group: 'strength', level: 'Beginner', sets: 3, reps: 12, why: 'Stiff, strong ankles and Achilles tendons give you spring.', cues: ['Stand on the edge of a step, heels free.', 'Rise high on your toes, pause one second.', 'Lower slowly, below the step if you can.', 'Keep the knees straight.'] },
  { name: 'Hip thrust', group: 'strength', level: 'Beginner', sets: 3, reps: 8, why: 'Strong glutes for the final push of the jump.', cues: ['Upper back on a bench, feet flat, knees bent.', 'Drive the hips up until the body is a straight line.', 'Squeeze the glutes at the top for a second.', 'Chin tucked, do not over-arch the back.'] },

  // ----- jumps -----
  { name: 'Pogo hops', group: 'jumps', level: 'Beginner', sets: 3, reps: 15, why: 'Trains stiff, springy ankles with very little impact.', cues: ['Legs almost straight, bounce from the ankles.', 'Stay on the balls of the feet, spend as little time on the floor as you can.', 'Stay tall, arms relaxed.', 'Quick and quiet, like the floor is hot.'] },
  { name: 'Box jump', group: 'jumps', level: 'Beginner', sets: 3, reps: 5, why: 'Power without a hard landing: you jump up and step down.', cues: ['Choose a box you can land on with a soft knee bend.', 'Swing your arms, jump as high as you can.', 'Land softly and quietly on the whole foot.', 'Step down, do not jump down. Reset between reps.'] },
  { name: 'Countermovement jump', group: 'jumps', level: 'Beginner', sets: 3, reps: 5, why: 'The jump you test. Practise it at full effort with full rest.', cues: ['Dip fast, swing the arms back.', 'Drive up and reach as high as you can.', 'Land on both feet, knees bent.', 'Rest a minute between jumps so each one is a full effort.'] },
  { name: 'Broad jump', group: 'jumps', level: 'Beginner', sets: 3, reps: 4, why: 'Horizontal power, and a good landing habit.', cues: ['Swing the arms and jump out as far as you can.', 'Land on both feet and hold the landing for two seconds.', 'Knees over the toes, chest up.', 'Walk back and reset.'] },
  { name: 'Jump squat', group: 'jumps', level: 'Intermediate', sets: 3, reps: 6, why: 'Trains force at speed. Bodyweight or a light load.', cues: ['Squat down to a comfortable depth.', 'Explode up and leave the floor.', 'Land softly and go straight into the next rep, or reset.', 'Keep the load light so the jump stays fast.'] },
  { name: 'Skater bounds', group: 'jumps', level: 'Intermediate', sets: 3, reps: 6, per: 'per side', why: 'Sideways power and single-leg landing strength.', cues: ['Push off one leg and bound to the side.', 'Land on the other leg and hold it for a second.', 'Knee over the toes, hips back.', 'Keep the chest up.'] },
  { name: 'Depth jump', group: 'jumps', level: 'Advanced', sets: 3, reps: 5, why: 'Trains the stretch reflex. Only after months of regular jump training.', cues: ['Step off a box of 30 to 40 cm, do not jump off.', 'The moment you land, jump as high as you can.', 'Minimal time on the floor.', 'Stop the set when the jumps get lower.'] },

  // ----- shooting -----
  { name: 'Form shooting', group: 'shooting', level: 'Beginner', sets: 5, reps: 10, why: 'Builds the repeatable shape of your shot, close to the rim.', cues: ['One or two metres from the rim, one hand.', 'Elbow under the ball and in line with the basket.', 'Extend fully and hold the follow-through.', 'Keep the wrist relaxed.'] },
  { name: 'Free throws', group: 'shooting', level: 'Beginner', sets: 2, reps: 10, why: 'The same routine every time. Free throws show your form under focus.', cues: ['Same foot position and breath every time.', 'Dip, shoot, hold the follow-through.', 'Count your makes to see the trend.', 'Do not rush the next shot.'] },
  { name: 'Wall elbow drill', group: 'shooting', level: 'Beginner', sets: 3, reps: 10, why: 'Teaches the elbow to stay under the ball.', cues: ['Stand close to a wall, shooting arm next to it.', 'Shoot without your elbow touching the wall too hard.', 'Keep the elbow tucked in.', 'Go slow and watch the path of the ball.'] },
  { name: 'Backspin shots lying down', group: 'shooting', level: 'Beginner', sets: 3, reps: 15, why: 'A fast, relaxed wrist flick gives backspin and a soft touch.', cues: ['Lie on your back and shoot the ball straight up.', 'Snap the wrist through the ball.', 'The ball should spin backwards and come straight down.', 'Catch it without moving your hands.'] },
  { name: 'Catch-and-shoot', group: 'shooting', level: 'Intermediate', sets: 3, reps: 8, why: 'A quick, repeatable release from a pass.', cues: ['Have your feet ready before the ball arrives.', 'Catch low, go straight into the dip.', 'Same shot as form shooting, just faster.', 'Take only as many as you can keep clean.'] },
];
