-- Run rate limiting with the caller's service-role privileges.

alter function public.consume_rate_limit(text, text, integer, integer)
security invoker;
