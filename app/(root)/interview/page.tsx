import InterviewSetup from "@/components/InterviewSetup";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import React from "react";

const page = async () => {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect("/sign-in");
  }

  return (
    <>
      <InterviewSetup userId={user.id} />
    </>
  );
};

export default page;
