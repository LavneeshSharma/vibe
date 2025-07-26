"use client";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const page = () => {
  const [value, setValue] = useState("");
  const trpc= useTRPC();
  const {data:messages}=useQuery(trpc.messages.getMany.queryOptions());
  const createMessage=useMutation(trpc.messages.create.mutationOptions({
    onSuccess: (data) => {
      toast.success("Message created successfully!");
    },
    onError: (error) => {
      console.error("Mutation failed:", error);
    },
  }))
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button disabled={createMessage.isPending} onClick={()=>{createMessage.mutate({ value: value })}}>
      Invoke AI
      </Button>
      {JSON.stringify(messages,null,2)}
    </div>
  )
}

export default page