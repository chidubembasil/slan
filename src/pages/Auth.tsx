import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

export default function Auth() {

  const [formData, setFormData] = useState({
    email: "",
    otp: "",
  });

  const [errors, setErrors] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setErrors({
      ...errors,
      [e.target.name]: "",
    });
  }

  function validateEmail() {
    let newErrors:any = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email required";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  function validateOTP() {

    let newErrors:any = {};

    if (!formData.otp.trim()) {
      newErrors.otp = "OTP required";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  }

  async function sendOTP() {

    if (!validateEmail()) return;

    try {

      setLoading(true);

      const res = await fetch(
        "http://localhost:5000/api/auth/send-otp",
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            email:formData.email
          })
        }
      );

      const data = await res.json();

      if(data.success){
        setOtpSent(true);
      }

    } catch(err){
      console.log(err);
    }
    finally{
      setLoading(false);
    }

  }

  async function verifyOTP(
    e:React.FormEvent
  ) {

    e.preventDefault();

    if(!validateOTP()) return;

    try{

      setLoading(true);

      const res = await fetch(
        "http://localhost:5000/api/auth/verify-otp",
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            email:formData.email,
            otp:formData.otp
          })
        }
      );

      const data = await res.json();

      /*
      backend response:
      {
      success:true,
      token:"jwt_here",
      role:"admin"
      }
      */

      if(data.success){

        localStorage.setItem(
          "token",
          data.token
        );

        localStorage.setItem(
          "role",
          data.role
        );

        window.location.href="/dashboard";
      }

    }catch(err){
      console.log(err);
    }
    finally{
      setLoading(false);
    }

  }

  return(
    <div className="w-full flex justify-center items-center h-screen bg-gray-50">

      <form
      onSubmit={verifyOTP}
      className="shadow-md bg-white w-full max-w-[30%] min-w-[320px] p-6 rounded-xl flex flex-col gap-4">

        <div>
          <h1 className="text-2xl font-semibold text-[#0d2147]">
            Admin Login
          </h1>

          <p className="text-sm text-gray-500">
            Please enter your credentials to access the management dashboard.
          </p>
        </div>

        <div className="flex flex-col gap-1">

          <label>Email*</label>

          <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="admin@slan.com"
          className={`h-10 p-2 border rounded-md
          ${
            errors.email
            ? "border-red-500"
            : "border-[#c8d1c1]"
          }
          `}
          />

          {
            errors.email &&
            <p className="text-red-500 text-sm">
              {errors.email}
            </p>
          }

        </div>

        {
          otpSent && (

          <div className="flex flex-col gap-1">

            <label>OTP Code*</label>

            <input
            type="text"
            name="otp"
            value={formData.otp}
            onChange={handleChange}
            placeholder="OTP"
            className={`h-10 p-2 border rounded-md
            ${
              errors.otp
              ? "border-red-500"
              : "border-[#c8d1c1]"
            }
            `}
            />

            {
              errors.otp &&
              <p className="text-red-500 text-sm">
                {errors.otp}
              </p>
            }

          </div>

          )
        }

        {
          !otpSent ? (

            <button
            type="button"
            onClick={sendOTP}
            className="w-full h-10 bg-[#004900] text-white rounded-md"
            >
              {
                loading
                ? "Sending..."
                : "Send OTP"
              }
            </button>

          ) : (

            <button
            type="submit"
            className="w-full h-10 bg-[#004900] text-white rounded-md flex justify-center items-center"
            >
              {
                loading
                ? "Authenticating..."
                :
                <>
                Authorize Access
                <ArrowRightIcon size={18}/>
                </>
              }
            </button>

          )
        }

      </form>

    </div>
  )
}