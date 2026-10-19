UPDATE account_appearances
SET animal = animal || '_ADULT'
WHERE avatar_type = 'ANIMAL'
  AND animal IN (
      'LION', 'BEAR', 'KOALA', 'TURTLE', 'OWL', 'HIPPO',
      'SNAKE', 'FOX', 'RABBIT', 'OTTER', 'CHEETAH'
  );
