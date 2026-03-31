"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import { deleteInterview } from "@/lib/actions/interview.action";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteInterviewButtonProps {
    interviewId: string;
    userId: string;
}

export default function DeleteInterviewButton({
    interviewId,
    userId,
}: DeleteInterviewButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteInterview(interviewId, userId);
            if (result.success) {
                toast.success("Interview deleted successfully.");
            } else {
                toast.error(result.error || "Failed to delete interview.");
            }
        } catch (error) {
            toast.error("An unexpected error occurred.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 left-2 size-8 bg-black/50 hover:bg-black/80 hover:text-red-500 border border-dark-600 rounded-md backdrop-blur-sm z-10"
                    disabled={isDeleting}
                >
                    <Trash2 size={16} />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-dark-900 border-dark-700 text-light-900">
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="text-light-700">
                        This action cannot be undone. This will permanently delete your
                        generated interview and any associated feedback data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="bg-dark-800 text-light-900 border-dark-600 xl:hover:bg-dark-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white xl:hover:bg-red-700">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
