import {
  getCurrentUser,
  isAuthenticated,
} from "@/lib/actions/auth.action";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");

  const user = await getCurrentUser();

  return (
    <div className="root-layout">
      <nav className="flex justify-between items-center px-6 py-4 shadow-sm">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Logo" height={32} width={38} priority />
          <h2 className="text-primary-100 font-semibold">InterviewPrep AI</h2>
        </Link>

        {/* Right: Profile Dropdown (client-only to avoid Radix hydration mismatch) */}
        <ProfileDropdown userName={user?.name} userEmail={user?.email} />
      </nav>

      {/* Page content */}
      {children}
    </div>
  );
};

export default RootLayout;
