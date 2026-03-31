"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import FormField from "./FormField";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/firebase/client";
import { signIn, signUp } from "@/lib/actions/auth.action";

const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(3),
  });
};

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const formSchema = authFormSchema(type);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (type === "sign-up") {
        const { name, email, password } = values;

        const userCredentials = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const result = await signUp({
          uid: userCredentials.user.uid,
          name: name!,
          email,
          password,
        });

        if (!result?.success) {
          toast.error(result?.message);
          return;
        }

        toast.success("Account created successfully. Please sign in.");
        router.push("/sign-in");
      } else {
        const { email, password } = values;

        const userCredentials = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        const idToken = await userCredentials.user.getIdToken();

        if (!idToken) {
          toast.error("Sign in failed");
          return;
        }

        await signIn({ email, idToken });

        toast.success("Signed in successfully.");
        router.push("/");
      }
    } catch (error: unknown) {
      // Comment this out if you don’t want it logged
      // console.error("Sign-in error:", error);

      const err = error as { code?: string };
      if (err?.code) {
        switch (err.code) {
          case "auth/invalid-email":
            toast.error("Invalid email format. Please try again.");
            break;
          case "auth/user-not-found":
            toast.error("No account found with this email.");
            break;
          case "auth/wrong-password":
            toast.error("Incorrect password. Please try again.");
            break;
          case "auth/email-already-in-use":
            toast.error("This email is already registered. Try signing in.");
            break;
          case "auth/weak-password":
            toast.error("Password must be at least 6 characters long.");
            break;
          case "auth/invalid-credential":
            toast.error("Invalid email or password.");
            break;
          default:
            toast.error("Something went wrong. Please try again later.");
        }
      } else {
        toast.error("Unexpected error occurred. Please try again.");
      }
    }
  }

  function handleSubmitWrapper(e: React.BaseSyntheticEvent) {
    form.handleSubmit(onSubmit)(e).catch(() => {
      toast.error("Something went wrong. Please try again.");
    });
  }

  const isSignIn = type === "sign-in";

  return (
    <div className="card-border lg:min-w-[556px]">
      <div className="flex flex-col gap-6 card py-14 px-10">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.svg" alt="logo" height={32} width={38} />
          <h2 className="text-primary-100">InterviewPrep AI</h2>
        </div>

        <h3>Practice job interview with AI</h3>
        {!mounted ? (
          <div className="w-full space-y-6 mt-4 form" aria-hidden="true">
            {!isSignIn && (
              <div className="space-y-2">
                <div className="label h-4 w-16 bg-muted rounded animate-pulse" />
                <div className="input h-9 bg-muted rounded animate-pulse" />
              </div>
            )}
            <div className="space-y-2">
              <div className="label h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="input h-9 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="label h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="input h-9 bg-muted rounded animate-pulse" />
            </div>
            <div className="btn h-9 w-full bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={handleSubmitWrapper}
              className="w-full space-y-6 mt-4 form"
            >
              {!isSignIn && (
                <FormField
                  control={form.control}
                  name="name"
                  label="Name"
                  placeholder="Your name"
                />
              )}
              <FormField
                control={form.control}
                name="email"
                label="Email"
                placeholder="Your email address"
                type="email"
              />

              <FormField
                control={form.control}
                name="password"
                label="Password"
                placeholder="Enter your password"
                type="password"
              />

              <Button className="btn" type="submit">
                {isSignIn ? "Sign in" : "Create an Account"}
              </Button>
            </form>
          </Form>
        )}

        <p className="text-center">
          {isSignIn ? "Don't have an account? " : "Already have an account? "}
          <Link
            href={!isSignIn ? "/sign-in" : "/sign-up"}
            className="font-bold text-user-primary ml-1"
          >
            {!isSignIn ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;
