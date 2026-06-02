create policy "users can update own events"
  on application_events for update
  using (auth.uid() = user_id);
