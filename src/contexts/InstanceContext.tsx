/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useParams } from "react-router-dom";

import { useFetchInstance } from "@/lib/queries/instance/fetchInstance";

import { Instance } from "@/types/evolution.types";

interface InstanceContextProps {
  instance: Instance | null;
  reloadInstance: () => Promise<void>;
}

export const InstanceContext = createContext<InstanceContextProps | null>(null);

export const useInstance = () => {
  const context = useContext(InstanceContext);
  if (!context) {
    throw new Error("useInstance must be used within an InstanceProvider");
  }
  return context;
};

interface InstanceProviderProps {
  children: ReactNode;
}

export const InstanceProvider: React.FC<InstanceProviderProps> = ({ children }): React.ReactNode => {
  const queryParams = useParams<{ instanceId: string }>();
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const { data: instance, refetch: reloadInstance } = useFetchInstance({
    instanceId,
  });

  useEffect(() => {
    if (queryParams.instanceId) {
      setInstanceId(queryParams.instanceId);
    } else {
      setInstanceId(null);
    }
  }, [queryParams]);

  return (
    <InstanceContext.Provider
      value={{
        instance: instance ?? null,
        reloadInstance: async () => {
          await reloadInstance();
        },
      }}>
      {children}
    </InstanceContext.Provider>
  );
};
