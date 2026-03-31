"use client";

import { cn, getTechLogos } from "@/lib/utils";
import Image from "next/image";
import React, { useEffect, useState } from "react";

const DisplayTechIcons = ({ techStack }: { techStack: string[] }) => {
  const [mounted, setMounted] = useState(false);
  const [techIcons, setTechIcons] = useState<{ tech: string; url: string }[]>([]);

  useEffect(() => {
    setMounted(true);
    const fetchIcons = async () => {
      const icons = await getTechLogos(techStack);
      setTechIcons(icons);
    };
    fetchIcons();
  }, [techStack]);

  if (!mounted) {
    return (
      <div className="flex flex-row gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="size-9 animate-pulse rounded-full bg-dark-300"
          />
        ))}
      </div>
    );
  }

  if (techIcons.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">—</span>
    );
  }

  return (
    <div className="flex flex-row">
      {techIcons.slice(0, 3).map(({ tech, url }, index) => (
        <div
          key={tech}
          className={cn(
            "relative group bg-dark-300 rounded-full p-2 flex-center",
            index >= 1 && "-ml-3"
          )}
        >
          <span className="tech-tooltip">{tech}</span>
          <Image
            src={url}
            alt={tech}
            width={100}
            height={100}
            className="size-5"
          />
        </div>
      ))}
    </div>
  );
};

export default DisplayTechIcons;
