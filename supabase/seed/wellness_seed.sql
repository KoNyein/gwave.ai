-- Wellness starter content. Health items are gentle guidance only — never a
-- diagnosis — and always point to professional care. Idempotent-ish: safe to
-- run once on a fresh DB.

insert into public.wellness_items (kind, title, body, duration_minutes, position) values
-- Dhamma
('dhamma', 'Loving-kindness (Mettā)',
 'A short daily reflection on wishing well-being for yourself and others. May all beings be happy, may all beings be free from suffering.', 10, 1),
('dhamma', 'Mindfulness of breathing (Ānāpānasati)',
 'Rest your attention gently on the natural breath. When the mind wanders, kindly return to the breath.', 15, 2),
('dhamma', 'Reflection on impermanence (Anicca)',
 'A calming contemplation on the changing nature of all things, easing attachment and worry.', 10, 3),
('dhamma', 'Evening gratitude',
 'Close the day by recalling three things you were grateful for, and offering goodwill to others.', 5, 4);

insert into public.wellness_items (kind, title, body, duration_minutes, position) values
-- Meditation timers
('meditation', 'Quiet sitting — 5 minutes', 'A short seated meditation to settle the mind.', 5, 1),
('meditation', 'Calm breathing — 10 minutes', 'Follow the breath and let the body relax.', 10, 2),
('meditation', 'Deep rest — 20 minutes', 'A longer sit for deeper stillness.', 20, 3),
('meditation', 'Body scan — 15 minutes', 'Gently move attention through the body, releasing tension.', 15, 4);

insert into public.wellness_items (kind, title, body, url, position) values
-- Radio / listening (placeholder URLs — replace with your licensed streams)
('radio', 'Dhamma talks (audio)', 'Listen to recorded dhamma talks and chanting.', '', 1),
('radio', 'Calm music', 'Gentle instrumental music for relaxation.', '', 2),
('radio', 'Nature sounds', 'Rain, forest and stream sounds for rest.', '', 3);

insert into public.wellness_items (kind, title, body, position) values
-- Health guidance (NOT diagnosis — when-to-seek-care red flags + habits)
('health', 'When to seek urgent care',
 'Call your local emergency number right away for: chest pain or pressure, sudden weakness or trouble speaking, difficulty breathing, severe bleeding, fainting, or a sudden severe headache. When in doubt, seek help.', 1),
('health', 'Daily wellbeing habits',
 'Gentle movement, staying hydrated, regular sleep, connecting with loved ones, and taking medicines as prescribed all support health. Your doctor can tailor advice to you.', 2),
('health', 'Medication reminders',
 'Keep a simple list of your medicines and times. Use the Reminders feature or ask a family member to help you stay on schedule.', 3),
('health', 'Regular check-ups',
 'Routine visits help catch issues early. Keep appointments and share any new symptoms with your doctor.', 4);
