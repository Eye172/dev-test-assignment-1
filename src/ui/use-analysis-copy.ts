"use client";
import { useCallback } from "react";
import { useDisplay } from "./display";
import { analysisCopy } from "./analysis-copy";
export function useAnalysisCopy(){const {locale}=useDisplay();return useCallback((text:string)=>analysisCopy(text,locale),[locale]);}
