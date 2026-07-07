import { redirect } from "next/navigation";
import {
  Atom,
  BookOpen,
  Bot,
  Code2,
  FlaskConical,
  Leaf,
  Rocket,
  Sprout,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ageBandOf, getCurrentProfile, type AgeBand } from "@/lib/auth";

export const metadata = { title: "Learn" };
export const dynamic = "force-dynamic";

type Track = {
  icon: LucideIcon;
  title: string;
  description: string;
  tag: string;
};

// Age-appropriate learning tracks. Under-16 sees STEM basics; 16-17 adds
// programming and applied science; adults see grower/agri science.
const CHILD_TRACKS: Track[] = [
  {
    icon: FlaskConical,
    title: "Science Starters",
    description:
      "Fun experiments about plants, water and light you can try safely at home.",
    tag: "STEM",
  },
  {
    icon: Sprout,
    title: "How Plants Grow",
    description:
      "Seeds, soil, sunshine and the science of growing your first plant.",
    tag: "Biology",
  },
  {
    icon: Atom,
    title: "Little Scientist",
    description: "Simple ideas about atoms, weather and how the world works.",
    tag: "STEM",
  },
];

const TEEN_TRACKS: Track[] = [
  {
    icon: Code2,
    title: "Intro to Programming",
    description:
      "Start coding with beginner-friendly lessons in Python and JavaScript.",
    tag: "Coding",
  },
  {
    icon: Bot,
    title: "AI & Robotics Basics",
    description:
      "How AI, sensors and automation are changing farming and industry.",
    tag: "Technology",
  },
  {
    icon: Rocket,
    title: "Build Your First App",
    description:
      "Project-based lessons that take you from idea to a working prototype.",
    tag: "Projects",
  },
];

const ADULT_TRACKS: Track[] = [
  {
    icon: Leaf,
    title: "Applied Agri-Science",
    description:
      "Hydroponics, nutrients, and data-driven growing for modern farms.",
    tag: "Growing",
  },
  {
    icon: Code2,
    title: "Programming for Growers",
    description:
      "Automate your farm with sensors, dashboards and simple scripts.",
    tag: "Coding",
  },
  {
    icon: Bot,
    title: "Farm Tech & Automation",
    description: "IoT, drones and AI applied to real-world agriculture.",
    tag: "Technology",
  },
];

function tracksFor(band: AgeBand): { heading: string; tracks: Track[] } {
  if (band === "child" || band === "preteen") {
    return { heading: "STEM for young explorers", tracks: CHILD_TRACKS };
  }
  if (band === "teen") {
    return { heading: "Programming & technology", tracks: TEEN_TRACKS };
  }
  return { heading: "Grower & tech learning", tracks: ADULT_TRACKS };
}

export default async function LearnPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const band = ageBandOf(profile.birth_date);
  const { heading, tracks } = tracksFor(band);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Learn</h1>
          <p className="text-sm text-muted-foreground">{heading}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tracks.map((track) => (
          <Card key={track.title} className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-start gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <track.icon className="h-6 w-6" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{track.title}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                    {track.tag}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {track.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          More lessons are on the way. 🌱
        </CardContent>
      </Card>
    </div>
  );
}
