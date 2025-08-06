import { getQueryClient, trpc } from '@/trpc/server';
import { dehydrate, HydrationBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ProjectView } from '@/modules/projects/ui/views/project-view';
import  {ErrorBoundary } from "react-error-boundary";
interface Props{
    params:Promise<{
        projectId:string
    }>
}
const page = async ({params}:Props ) => {
const {projectId}=await params;
const queryClient=getQueryClient();
void queryClient.prefetchQuery(trpc.messages.getMany.queryOptions({
    projectId,
}))
return(
    
    <HydrationBoundary state={dehydrate(queryClient)}>
        <ErrorBoundary fallback={<div>Error</div>}>
        <Suspense fallback={<p>Loading...</p>}>
           <ProjectView projectId={projectId} />
        </Suspense>
        </ErrorBoundary>
    </HydrationBoundary>
    
)
}

export default page