"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOutAction } from "@/lib/actions/auth.action";
import { LogOut, User } from "lucide-react";

interface ProfileDropdownProps {
  userName: string | undefined;
  userEmail: string | undefined;
}

export function ProfileDropdown({ userName, userEmail }: ProfileDropdownProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="rounded-full">
        <Image
          src="/default-avatar.png"
          alt={userName ?? "Profile"}
          width={56}
          height={56}
          className="rounded-full cursor-pointer"
        />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Image
          src="/default-avatar.png"
          alt={userName ?? "Profile"}
          width={56}
          height={56}
          className="rounded-full cursor-pointer"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-dark-200 border-dark-300 text-light-100 z-50">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userName || "User"}</p>
            <p className="text-xs leading-none text-light-400">
              {userEmail || "No email provided"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-dark-300" />
        <DropdownMenuItem asChild className="cursor-pointer hover:!bg-dark-300 focus:bg-dark-300">
          <Link href="/profile" className="flex items-center w-full text-light-100">
            <User className="mr-2 size-4" />
            <span>View Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-dark-300" />
        <DropdownMenuItem asChild className="cursor-pointer hover:!bg-dark-300 focus:bg-dark-300">
          <form action={signOutAction} className="w-full">
            <button type="submit" className="flex items-center w-full text-red-500">
              <LogOut className="mr-2 size-4" />
              <span>Sign Out</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
