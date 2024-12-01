import dataclasses
from typing import Dict, List, Optional, Set


@dataclasses.dataclass
class Segment:
    name: str
    initial_volume: float
    compressible: bool
    connections: Set["Segment"] = dataclasses.field(default_factory=set)

    def connect(self, other: "Segment"):
        self.connections.add(other)
        other.connections.add(self)

    def __hash__(self):
        return hash(self.name)
@dataclasses.dataclass
class Checkpoint:
    volumes: Dict[str, float]
    pressure: float

    def pprint(self):
        print(f"At {self.pressure} (total {sum(self.volumes.values()):.2f})")
        for k, v in sorted(self.volumes.items(), key=lambda x: x[0]):
            print(f"{k}: {v:.2f}")
        print()


@dataclasses.dataclass
class Model:
    segments: List[Segment]


    def get_volumes_at_pressure(self, pressure: float, checkpoint: Optional[Checkpoint] = None) -> Checkpoint:
        if checkpoint is None:
            checkpoint = self.get_initial_checkpoint()
        total_volume = sum(checkpoint.volumes.values())

        compression_rate = pressure / checkpoint.pressure
        new_volume = total_volume / compression_rate
        volume_left = new_volume
        result = {}
        for segment in self.segments:
            if segment.compressible:
                continue
            result[segment.name] = segment.initial_volume
            volume_left -= segment.initial_volume

        total_compressable_volume = sum(s.initial_volume for s in self.segments if s.compressible)
        for segment in self.segments:
            if not segment.compressible:
                continue
            result[segment.name] = volume_left * segment.initial_volume / total_compressable_volume
        return Checkpoint( result, pressure)


    def get_initial_checkpoint(self) -> Checkpoint:
        return Checkpoint({s.name: s.initial_volume for s in self.segments}, 1)


def main():
    lungs = Segment("lungs", 5000, True)
    nasopharynx = Segment("nasopharynx", 250, True)
    sinuses = Segment("sinuses", 90, False)
    middle_ear = Segment("middle_ear", 1, False)

    lungs.connect(nasopharynx)
    nasopharynx.connect(sinuses)
    nasopharynx.connect(middle_ear)

    model = Model([lungs, nasopharynx, sinuses, middle_ear])
    model.get_volumes_at_pressure(1).pprint()
    model.get_volumes_at_pressure(2).pprint()
    model.get_volumes_at_pressure(3).pprint()
    model.get_volumes_at_pressure(20).pprint()






if __name__ == '__main__':
    main()