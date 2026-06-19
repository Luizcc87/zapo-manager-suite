import { QueryKey, UseQueryOptions } from "@tanstack/react-query";

export type UseQueryParams<T> = Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryFn" | "queryKey">;
