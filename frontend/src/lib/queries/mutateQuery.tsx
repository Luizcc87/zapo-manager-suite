import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface MutationCallbacks<TData, TError, TVariables, TContext> {
  onSuccess?: (data: TData, variables?: TVariables, context?: TContext | undefined) => void;
  onError?: (error: TError, variables?: TVariables, context?: TContext | undefined) => void;
  onSettled?: (data: TData | undefined, error: TError | null, variables?: TVariables, context?: TContext | undefined) => void;
}

interface IOptions {
  invalidateKeys?: string[][];
}

export function useManageMutation<TData, TError, TVariables, TContext>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: IOptions,
): (parameters: TVariables, callbacks?: MutationCallbacks<TData, TError, TVariables, TContext>) => Promise<TData> {
  const queryClient = useQueryClient();

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    mutationFn,
  });

  return (parameters: TVariables, callbacks?: MutationCallbacks<TData, TError, TVariables, TContext>) =>
    mutation.mutateAsync(parameters, {
      onSuccess: async (data, variables, context) => {
        if (options?.invalidateKeys) {
          await Promise.all(
            options.invalidateKeys.map((key) =>
              queryClient.invalidateQueries({
                queryKey: key,
              }),
            ),
          );
        }
        callbacks?.onSuccess?.(data, variables, context);
      },
      onError(error, variables, context) {
        callbacks?.onError?.(error, variables, context);
      },
      onSettled(data, error, variables, context) {
        callbacks?.onSettled?.(data, error, variables, context);
      },
    });
}
