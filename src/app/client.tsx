"use client";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { tr } from "date-fns/locale";

export const Client = () => {
    const trpc = useTRPC();
    const { data } = useSuspenseQuery(trpc.createai.queryOptions({ text: "Hello" }));
    return (
        <div>
            {JSON.stringify(data)}
        </div>
    );
}