import unittest
from contact import stroke_point
class ContactTrajectory(unittest.TestCase):
 def setUp(self):self.c={'startS':1.,'endS':2.,'fromZM':-.012,'toZM':.012,'clearanceM':.03}
 def point(self,t):return stroke_point(t,4.,self.c,.0275,.0012,.00175)
 def test_contact_tracks_strip_plane_and_length(self):
  start=self.point(1.);end=self.point(2.)
  self.assertAlmostEqual(start[0],-.03045);self.assertAlmostEqual(start[0],end[0]);self.assertAlmostEqual(end[2]-start[2],.024)
  for t in [1.,1.25,1.5,1.75,2.]:self.assertEqual(self.point(t)[1],0.);self.assertAlmostEqual(self.point(t)[0],start[0])
 def test_approach_and_withdraw_clear_surface(self):
  self.assertAlmostEqual(self.point(0.)[0],self.point(1.)[0]-.03)
  self.assertLess(self.point(2.5)[0],self.point(2.)[0]);self.assertAlmostEqual(self.point(4.)[2],-.012)
 def test_boundary_velocity_is_continuous(self):
  for t in [1.,2.]:
   a,b=self.point(t-1e-5),self.point(t+1e-5)
   self.assertLess(max(abs(x-y) for x,y in zip(a,b)),1e-8)
if __name__=='__main__':unittest.main()
